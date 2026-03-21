import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Thiếu ngày" }, { status: 400 });
    }

    const [bookings, guestBookings] = await Promise.all([
      prisma.booking.findMany({
        where: {
          courtId: Number(id),
          bookingDate: new Date(date),
          status: { notIn: ["CANCELLED"] },
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.guestBooking.findMany({
        where: {
          courtId: Number(id),
          bookingDate: new Date(date),
          status: { notIn: ["CANCELLED", "EXPIRED"] },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const allBookings = [...bookings, ...guestBookings];

    // Trả về danh sách slot đã đặt dạng ["07:00", "08:00", ...]
    const bookedSlots: string[] = [];
    for (const b of allBookings) {
      const start = b.startTime.toISOString().slice(11, 16);
      const end = b.endTime.toISOString().slice(11, 16);
      // Generate tất cả slot trong khoảng start-end
      let [h, m] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      while (h * 60 + m < eh * 60 + em) {
        bookedSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        m += 30;
        if (m >= 60) { h++; m -= 60; }
      }
    }

    return NextResponse.json({ bookedSlots });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}