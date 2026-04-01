import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function vnMidnightUTC(): Date {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}

// GET: danh sách ca kiểm kê hôm nay
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "WAREHOUSE_MANAGER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json([]);

  const todayUTC = vnMidnightUTC();
  const shifts = await prisma.inventoryShift.findMany({
    where: {
      facilityId: facilityStaff.facilityId,
      shiftDate: { gte: todayUTC, lt: new Date(todayUTC.getTime() + 86400000) },
    },
    include: {
      items: {
        include: { service: { select: { name: true, type: true } } },
        orderBy: { service: { name: "asc" } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(shifts);
}

// POST: mở ca kiểm kê mới
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "WAREHOUSE_MANAGER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json({ error: "Chưa được gắn vào cơ sở" }, { status: 400 });

  const { shiftType, notes } = await req.json();
  if (!["MORNING", "AFTERNOON", "EVENING"].includes(shiftType)) {
    return NextResponse.json({ error: "Loại ca không hợp lệ" }, { status: 400 });
  }

  const todayUTC = vnMidnightUTC();

  // Kiểm tra ca này đã tồn tại chưa
  const existing = await prisma.inventoryShift.findFirst({
    where: {
      facilityId: facilityStaff.facilityId,
      shiftDate: { gte: todayUTC, lt: new Date(todayUTC.getTime() + 86400000) },
      shiftType,
    },
  });
  if (existing) return NextResponse.json({ error: "Ca này hôm nay đã được mở rồi" }, { status: 400 });

  // Lấy tất cả hàng hóa đang hoạt động
  const services = await prisma.service.findMany({
    where: { facilityId: facilityStaff.facilityId, isActive: true },
  });

  const shift = await prisma.inventoryShift.create({
    data: {
      facilityId: facilityStaff.facilityId,
      managerId: userId,
      shiftDate: todayUTC,
      shiftType,
      notes: notes || null,
      status: "OPEN",
      items: {
        create: services.map(s => ({
          serviceId: s.id,
          openingStock: s.stockQuantity,
          sold: 0,
          returned: 0,
        })),
      },
    },
    include: {
      items: {
        include: { service: { select: { name: true, type: true } } },
        orderBy: { service: { name: "asc" } },
      },
    },
  });

  return NextResponse.json(shift, { status: 201 });
}
