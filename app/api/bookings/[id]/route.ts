import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id: Number(id) },
      include: {
        court: {
          include: {
            facility: { select: { id: true, name: true, address: true } },
            category: { select: { id: true, name: true, iconUrl: true } },
          },
        },
      },
    });

    if (!booking) return NextResponse.json({ error: "Không tìm thấy booking" }, { status: 404 });
    if (booking.customerId !== Number((session.user as any).id)) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    return NextResponse.json({
      id: booking.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime.toISOString().slice(11, 16),
      endTime: booking.endTime.toISOString().slice(11, 16),
      totalPrice: Number(booking.totalPrice),
      courtId: booking.courtId,
      courtName: booking.court.name,
      categoryId: booking.court.categoryId,
      facility: booking.court.facility,
      sport: booking.court.category,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
