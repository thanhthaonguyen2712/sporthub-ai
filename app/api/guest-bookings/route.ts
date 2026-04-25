import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailGuestBookingPending } from "@/lib/email";

function buildVietQRUrl(bankBin: string, accountNumber: string, accountName: string, amount: number, bookingId: number) {
  const info = encodeURIComponent(`DAT SAN #${bookingId}`);
  const name = encodeURIComponent(accountName);
  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${info}&accountName=${name}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guestName, guestPhone, guestEmail, courtId, bookingDate, startTime, endTime, totalPrice } = body;

    if (!guestName || !guestPhone || !courtId || !bookingDate || !startTime || !endTime || !totalPrice) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const court = await prisma.court.findUnique({
      where: { id: Number(courtId) },
      include: { facility: { select: { ownerId: true, name: true } } },
    });
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
        status: "PENDING",
        expiredAt,
      },
    });

    // Tìm tài khoản ngân hàng mặc định của chủ sân để tạo VietQR động
    let vietqrUrl: string | null = null;
    const defaultBank = await prisma.bankAccount.findFirst({
      where: { userId: court.facility.ownerId, isDefault: true },
    });
    if (defaultBank) {
      const parts = defaultBank.bankName.split("|");
      const bankBin = parts[0];
      if (bankBin) {
        vietqrUrl = buildVietQRUrl(bankBin, defaultBank.accountNumber, defaultBank.accountName, Number(totalPrice), booking.id);
      }
    }

    // Gửi email xác nhận chờ cho khách
    if (guestEmail) {
      sendEmail(
        guestEmail,
        "Đơn đặt sân đang chờ xác nhận — SportHub AI",
        emailGuestBookingPending(
          guestName,
          booking.id,
          court.name,
          court.facility.name,
          new Date(bookingDate).toLocaleDateString("vi-VN"),
          startTime,
          endTime,
          Number(totalPrice)
        )
      ).catch(() => {});
    }

    // Thông báo cho chủ sân
    prisma.notification.create({
      data: {
        userId: court.facility.ownerId,
        title: `Đơn đặt sân mới — ${court.facility.name}`,
        content: `${guestName} (${guestPhone}) đặt sân ${court.name} ngày ${new Date(bookingDate).toLocaleDateString("vi-VN")} · ${startTime}–${endTime} · ${Number(totalPrice).toLocaleString("vi-VN")}đ`,
        type: "BOOKING",
        link: "/owner/dashboard",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, bookingId: booking.id, vietqrUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
