import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Tồn kho + lịch sử nhập/xuất gần nhất
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "WAREHOUSE_MANAGER" && role !== "STAFF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json({ services: [], logs: [] });

  const services = await prisma.service.findMany({
    where: { facilityId: facilityStaff.facilityId, isActive: true },
    orderBy: { name: "asc" },
  });

  const logs = await prisma.stockLog.findMany({
    where: { serviceId: { in: services.map((s) => s.id) } },
    include: { service: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ services, logs });
}

// POST: Nhập/xuất kho
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Chỉ quản lý kho mới được nhập/xuất hàng" }, { status: 403 });
  }

  const { serviceId, type, quantity, note } = await req.json();
  if (!serviceId || !type || !quantity) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }
  if (!["IMPORT", "EXPORT", "DAMAGE"].includes(type)) {
    return NextResponse.json({ error: "Loại không hợp lệ" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Không tìm thấy dịch vụ" }, { status: 404 });

  const delta = type === "IMPORT" ? Number(quantity) : -Number(quantity);
  if (type !== "IMPORT" && service.stockQuantity < Number(quantity)) {
    return NextResponse.json({ error: "Tồn kho không đủ" }, { status: 400 });
  }

  const [log] = await prisma.$transaction([
    prisma.stockLog.create({ data: { serviceId, type, quantity: Number(quantity), note } }),
    prisma.service.update({
      where: { id: serviceId },
      data: { stockQuantity: { increment: delta } },
    }),
  ]);

  return NextResponse.json(log, { status: 201 });
}
