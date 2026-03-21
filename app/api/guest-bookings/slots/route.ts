import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Trả về danh sách time slot đã bị đặt cho một court + ngày
export async function GET(req: NextRequest) {
  try {
    const courtId = req.nextUrl.searchParams.get("courtId");
    const date = req.nextUrl.searchParams.get("date");
    if (!courtId || !date) return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });

    const bookingDate = new Date(date);

    const [regular, guest] = await Promise.all([
      prisma.booking.findMany({
        where: { courtId: Number(courtId), bookingDate, status: { notIn: ["CANCELLED"] } },
        select: { startTime: true, endTime: true },
      }),
      prisma.guestBooking.findMany({
        where: { courtId: Number(courtId), bookingDate, status: { notIn: ["CANCELLED", "EXPIRED"] } },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const bookedSlots = [...regular, ...guest].map((b) => ({
      start: new Date(b.startTime).toISOString().substring(11, 16),
      end: new Date(b.endTime).toISOString().substring(11, 16),
    }));

    return NextResponse.json(bookedSlots);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
