import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailGuestBookingConfirmed, emailGuestBookingCancelled } from "@/lib/email";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);

  const facilities = await prisma.facility.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const facilityIds = facilities.map((f) => f.id);

  const bookings = await prisma.guestBooking.findMany({
    where: {
      court: { facilityId: { in: facilityIds } },
      status: "PENDING",
      expiredAt: { gt: new Date() },
    },
    include: {
      court: {
        include: {
          facility: { select: { id: true, name: true } },
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
      guestPhone: b.guestPhone,
      bookingDate: b.bookingDate,
      startTime: b.startTime,
      endTime: b.endTime,
      totalPrice: b.totalPrice,
      createdAt: b.createdAt,
      court: {
        name: b.court.name,
        sport: b.court.category.name,
        facility: b.court.facility.name,
      },
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { bookingId, action, bankAccountInfo } = await req.json();

  if (!bookingId || !["confirm", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const booking = await prisma.guestBooking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      court: {
        select: {
          name: true,
          facility: { select: { ownerId: true, name: true } },
        },
      },
    },
  });

  if (!booking || booking.court.facility.ownerId !== ownerId) {
    return NextResponse.json({ error: "Không tìm thấy đơn đặt" }, { status: 404 });
  }

  if (action === "confirm") {
    // Lấy hoặc tạo ví kinh doanh
    let wallet = await prisma.businessWallet.findUnique({ where: { userId: ownerId } });
    if (!wallet) {
      wallet = await prisma.businessWallet.create({
        data: { userId: ownerId, balance: 0, status: "ACTIVE" },
      });
    }
    const amount = Number(booking.totalPrice);
    const newBalance = Number(wallet.balance) + amount;

    // Xác nhận đơn + cộng tiền vào ví kinh doanh trong 1 transaction
    await prisma.$transaction([
      prisma.guestBooking.update({
        where: { id: Number(bookingId) },
        data: { status: "CONFIRMED" },
      }),
      prisma.businessWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      }),
      prisma.businessWalletTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: "DEPOSIT",
          description: `Đặt sân khách vãng lai #${bookingId} – ${booking.guestName} (${booking.guestPhone})`,
        },
      }),
    ]);
    // Email xác nhận cho khách vãng lai
    if (booking.guestEmail) {
      const dateStr = new Date(booking.bookingDate).toLocaleDateString("vi-VN");
      const start = new Date(booking.startTime).toISOString().substring(11, 16);
      const end = new Date(booking.endTime).toISOString().substring(11, 16);
      sendEmail(
        booking.guestEmail,
        "Đặt sân thành công — SportHub AI",
        emailGuestBookingConfirmed(
          booking.guestName,
          booking.id,
          booking.court.name,
          booking.court.facility.name,
          dateStr,
          start,
          end,
          Number(booking.totalPrice)
        )
      ).catch(() => {});
    }
  } else {
    await prisma.guestBooking.update({
      where: { id: Number(bookingId) },
      data: { status: "CANCELLED" },
    });

    // Email thông báo từ chối + hoàn tiền cho khách vãng lai
    if (booking.guestEmail) {
      const dateStr = new Date(booking.bookingDate).toLocaleDateString("vi-VN");
      sendEmail(
        booking.guestEmail,
        "Đơn đặt sân bị từ chối — SportHub AI",
        emailGuestBookingCancelled(
          booking.guestName,
          booking.id,
          booking.court.name,
          dateStr,
          Number(booking.totalPrice),
          bankAccountInfo || undefined
        )
      ).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
