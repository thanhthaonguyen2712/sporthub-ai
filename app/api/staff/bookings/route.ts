import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const date = new Date(dateStr);

  // Tìm cơ sở của nhân viên
  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json([]);

  const courts = await prisma.court.findMany({
    where: { facilityId: facilityStaff.facilityId, isActive: true },
    select: { id: true },
  });
  const courtIds = courts.map((c) => c.id);

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);

  const bookings = await prisma.booking.findMany({
    where: {
      courtId: { in: courtIds },
      bookingDate: { gte: start, lt: end },
      status: { not: "CANCELLED" },
    },
    include: {
      court: { select: { name: true, category: { select: { name: true } } } },
      customer: { select: { fullName: true, phone: true } },
      invoice: { select: { id: true, finalTotal: true, paymentMethod: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(bookings);
}

// Tạo đặt sân walk-in + hóa đơn
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staffId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const {
    courtId, bookingDate, startTime, endTime, totalPrice,
    customerName, customerPhone, isWalkIn,
    services, // [{ serviceId, quantity, price }]
    paymentMethod,
  } = await req.json();

  if (!courtId || !bookingDate || !startTime || !endTime || !totalPrice || !paymentMethod) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const dateObj = new Date(bookingDate);
  const startObj = new Date(`${bookingDate}T${startTime}:00`);
  const endObj = new Date(`${bookingDate}T${endTime}:00`);

  // Kiểm tra trùng lịch
  const conflict = await prisma.booking.findFirst({
    where: {
      courtId,
      bookingDate: dateObj,
      status: { notIn: ["CANCELLED"] },
      OR: [
        { startTime: { lt: endObj }, endTime: { gt: startObj } },
      ],
    },
  });
  if (conflict) return NextResponse.json({ error: "Khung giờ đã có người đặt" }, { status: 409 });

  const serviceFee = (services || []).reduce(
    (sum: number, s: any) => sum + s.quantity * Number(s.price),
    0
  );
  const finalTotal = Number(totalPrice) + serviceFee;

  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        bookingDate: dateObj,
        startTime: startObj,
        endTime: endObj,
        totalPrice: Number(totalPrice),
        status: "CONFIRMED",
        paymentStatus: "PAID",
        isWalkIn: isWalkIn !== false,
        walkInName: customerName || null,
        walkInPhone: customerPhone || null,
        createdByStaff: true,
        staffId,
        courtId,
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        subTotal: finalTotal,
        discountAmount: 0,
        finalTotal,
        paymentMethod,
        bookingId: booking.id,
        staffId,
        items: {
          create: (services || []).map((s: any) => ({
            serviceId: s.serviceId,
            quantity: s.quantity,
            price: Number(s.price),
          })),
        },
      },
      include: { items: true },
    });

    // Giảm tồn kho dịch vụ
    for (const s of services || []) {
      await tx.service.update({
        where: { id: s.serviceId },
        data: { stockQuantity: { decrement: s.quantity } },
      });
      await tx.stockLog.create({
        data: {
          serviceId: s.serviceId,
          type: "SOLD",
          quantity: s.quantity,
          note: `Hóa đơn #${invoice.id}`,
        },
      });
    }

    return { booking, invoice };
  });

  return NextResponse.json(result, { status: 201 });
}
