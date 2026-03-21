import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const phone = req.nextUrl.searchParams.get("phone");

    const booking = await prisma.guestBooking.findUnique({
      where: { id: Number(id) },
      include: {
        court: {
          include: {
            facility: { select: { name: true, address: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Không tìm thấy đặt sân" }, { status: 404 });
    }

    // Xác minh SĐT nếu được cung cấp
    if (phone && booking.guestPhone !== phone) {
      return NextResponse.json({ error: "Số điện thoại không khớp" }, { status: 403 });
    }

    return NextResponse.json({
      id: booking.id,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      guestEmail: booking.guestEmail,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: booking.totalPrice,
      status: booking.status,
      expiredAt: booking.expiredAt,
      createdAt: booking.createdAt,
      court: {
        name: booking.court.name,
        sport: booking.court.category.name,
        facility: booking.court.facility.name,
        address: booking.court.facility.address,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
