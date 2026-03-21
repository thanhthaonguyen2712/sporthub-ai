import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guestName, guestPhone, guestEmail, courtId, bookingDate, startTime, endTime, totalPrice } = body;

    if (!guestName || !guestPhone || !courtId || !bookingDate || !startTime || !endTime || !totalPrice) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const court = await prisma.court.findUnique({ where: { id: Number(courtId) } });
    if (!court) return NextResponse.json({ error: "Sân không tồn tại" }, { status: 404 });

    const startDt = new Date(`1970-01-01T${startTime}:00.000Z`);
    const endDt = new Date(`1970-01-01T${endTime}:00.000Z`);
    const bookingDateObj = new Date(bookingDate);

    // Kiểm tra trùng lịch với booking thường
    const conflict = await prisma.booking.findFirst({
      where: {
        courtId: Number(courtId),
        bookingDate: bookingDateObj,
        status: { notIn: ["CANCELLED"] },
        OR: [{ startTime: { lt: endDt }, endTime: { gt: startDt } }],
      },
    });
    if (conflict) return NextResponse.json({ error: "Khung giờ này đã được đặt!" }, { status: 409 });

    // Kiểm tra trùng lịch với guest booking
    const guestConflict = await prisma.guestBooking.findFirst({
      where: {
        courtId: Number(courtId),
        bookingDate: bookingDateObj,
        status: { notIn: ["CANCELLED", "EXPIRED"] },
        OR: [{ startTime: { lt: endDt }, endTime: { gt: startDt } }],
      },
    });
    if (guestConflict) return NextResponse.json({ error: "Khung giờ này đã được đặt!" }, { status: 409 });

    // expiredAt = booking date + endTime
    const [endH, endM] = endTime.split(":").map(Number);
    const expiredAt = new Date(bookingDate);
    expiredAt.setHours(endH, endM, 0, 0);

    const booking = await prisma.guestBooking.create({
      data: {
        guestName,
        guestPhone,
        guestEmail: guestEmail || null,
        courtId: Number(courtId),
        bookingDate: bookingDateObj,
        startTime: startDt,
        endTime: endDt,
        totalPrice: Number(totalPrice),
        status: "CONFIRMED",
        expiredAt,
      },
    });

    return NextResponse.json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
