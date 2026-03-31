import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/staff/pos/direct-sale - Bán F&B trực tiếp không cần đặt sân
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json({ error: "Nhân viên chưa được gắn vào cơ sở" }, { status: 403 });

  const { items, paymentMethod, note } = await req.json();
  // items: [{ serviceId, quantity, price }]

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Không có sản phẩm nào" }, { status: 400 });
  }
  if (!paymentMethod) {
    return NextResponse.json({ error: "Thiếu phương thức thanh toán" }, { status: 400 });
  }

  // Kiểm tra tất cả sản phẩm thuộc cơ sở nhân viên và còn hàng
  const serviceIds = items.map((i: any) => i.serviceId);
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, facilityId: facilityStaff.facilityId, isActive: true },
  });

  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "Một số sản phẩm không hợp lệ hoặc không thuộc cơ sở này" }, { status: 400 });
  }

  for (const item of items) {
    const svc = services.find((s) => s.id === item.serviceId);
    if (!svc || svc.stockQuantity < item.quantity) {
      return NextResponse.json({ error: `Sản phẩm "${svc?.name || item.serviceId}" không đủ hàng` }, { status: 400 });
    }
  }

  const subTotal = items.reduce((sum: number, i: any) => sum + i.quantity * Number(i.price), 0);

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.directSale.create({
      data: {
        facilityId: facilityStaff.facilityId,
        staffId: userId,
        subTotal,
        finalTotal: subTotal,
        paymentMethod,
        note: note || null,
        items: {
          create: items.map((i: any) => ({
            serviceId: i.serviceId,
            quantity: i.quantity,
            price: Number(i.price),
          })),
        },
      },
    });

    for (const item of items) {
      await tx.service.update({
        where: { id: item.serviceId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      await tx.stockLog.create({
        data: {
          serviceId: item.serviceId,
          type: "SOLD",
          quantity: item.quantity,
          note: `Bán trực tiếp #${created.id}`,
        },
      });
    }

    return created;
  });

  return NextResponse.json({ success: true, saleId: sale.id });
}

// GET /api/staff/pos/direct-sale - Lịch sử bán hàng trực tiếp hôm nay
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json([]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const sales = await prisma.directSale.findMany({
    where: {
      facilityId: facilityStaff.facilityId,
      createdAt: { gte: todayStart, lt: todayEnd },
    },
    include: {
      items: { include: { service: { select: { name: true } } } },
      staff: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sales);
}
