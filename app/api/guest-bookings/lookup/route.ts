import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone");
    if (!phone) return NextResponse.json({ error: "Thiếu số điện thoại" }, { status: 400 });

    const now = new Date();

    const bookings = await prisma.guestBooking.findMany({
      where: {
        guestPhone: phone,
        expiredAt: { gt: now },
        status: { notIn: ["CANCELLED", "EXPIRED"] },
      },
      include: {
        court: {
          include: {
            facility: { select: { name: true, address: true } },
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { bookingDate: "asc" },
    });

    return NextResponse.json(
      bookings.map((b) => ({
        id: b.id,
        guestName: b.guestName,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        totalPrice: b.totalPrice,
        status: b.status,
        expiredAt: b.expiredAt,
        court: {
          name: b.court.name,
          sport: b.court.category.name,
          facility: b.court.facility.name,
          address: b.court.facility.address,
        },
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
