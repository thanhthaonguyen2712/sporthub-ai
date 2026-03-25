import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        customerId: Number((session.user as any).id),
      },
      include: {
        court: {
          include: {
            category: true,
            facility: {
              select: { id: true, name: true, address: true },
            },
          },
        },
        invoice: {
          select: { finalTotal: true, paymentMethod: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = bookings.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      bookingDate: b.bookingDate,
      startTime: b.startTime.toISOString().slice(11, 16),
      endTime: b.endTime.toISOString().slice(11, 16),
      totalPrice: b.totalPrice,
      status: b.status,
      paymentStatus: b.paymentStatus,
      court: {
        name: b.court.name,
        category: b.court.category.name,
        iconUrl: b.court.category.iconUrl,
      },
      facility: {
        id: b.court.facility.id,
        name: b.court.facility.name,
        address: b.court.facility.address,
      },
      invoice: b.invoice,
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}