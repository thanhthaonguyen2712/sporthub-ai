import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendUserEmail, emailWalletTopup, emailBookingConfirmed } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const vnpParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && key !== "booking") {
      vnpParams[key] = value;
    }
  });

  const secureHash = searchParams.get("vnp_SecureHash");
  const responseCode = searchParams.get("vnp_ResponseCode");
  const bookingEncoded = searchParams.get("booking");

  // Verify signature
  const secretKey = process.env.VNPAY_HASH_SECRET!;
  const sortedParams = Object.keys(vnpParams).sort().reduce((result: Record<string, string>, key) => {
    result[key] = vnpParams[key];
    return result;
  }, {});

  const signData = new URLSearchParams(sortedParams).toString();
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (signed !== secureHash) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/bookings?error=invalid_signature`);
  }

  if (responseCode === "00" && bookingEncoded) {
    try {
     const bookingData = JSON.parse(Buffer.from(bookingEncoded, "base64").toString());
     const { courtId, bookingDate, startTime, endTime, totalPrice, serviceIds, userId, isTopup } = bookingData;
    // Nếu là nạp tiền ví
        if (isTopup) {
    const topupAmount = Number(vnpParams["vnp_Amount"]) / 100;
    const wallet = await prisma.wallet.findUnique({ where: { userId: Number(userId) } });
    if (wallet) {
        await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: topupAmount } },
        });
        await prisma.walletTransaction.create({
        data: {
            walletId: wallet.id,
            amount: topupAmount,
            type: "DEPOSIT",
            description: "Nạp tiền qua VNPay",
        },
        });
        const user = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { fullName: true } });
        const newBalance = Number(wallet.balance) + topupAmount;
        prisma.notification.create({
          data: {
            userId: Number(userId),
            title: "Nạp tiền ví thành công",
            content: `Đã nạp ${topupAmount.toLocaleString("vi-VN")}đ qua VNPay. Số dư: ${newBalance.toLocaleString("vi-VN")}đ.`,
            type: "PAYMENT",
            link: "/profile?tab=wallet",
          },
        }).catch(() => {});
        sendUserEmail(
          Number(userId),
          "Nạp tiền ví thành công — SportHub AI",
          emailWalletTopup(user?.fullName ?? "", topupAmount, newBalance)
        );
    }
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/profile?tab=wallet&topup=success`);
        }
      // Tạo booking
      const booking = await prisma.$transaction(async (tx) => {
        const newBooking = await tx.booking.create({
          data: {
            courtId: Number(courtId),
            customerId: Number(userId),
            bookingDate: new Date(bookingDate),
            startTime: new Date(`1970-01-01T${startTime}:00.000Z`),
            endTime: new Date(`1970-01-01T${endTime}:00.000Z`),
            totalPrice: Number(totalPrice),
            status: "CONFIRMED",
            paymentStatus: "PAID",
          },
        });

        await tx.invoice.create({
          data: {
            bookingId: newBooking.id,
            subTotal: Number(totalPrice),
            discountAmount: 0,
            finalTotal: Number(totalPrice),
            paymentMethod: "QR",
          },
        });

        return newBooking;
      });

      const courtInfo = await prisma.court.findUnique({ where: { id: Number(courtId) }, select: { name: true } });
      const userInfo = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { fullName: true } });
      prisma.notification.create({
        data: {
          userId: Number(userId),
          title: "Đặt sân thành công",
          content: `Sân ${courtInfo?.name ?? ""} ngày ${new Date(bookingDate).toLocaleDateString("vi-VN")} lúc ${startTime}–${endTime}. Đã thanh toán ${Number(totalPrice).toLocaleString("vi-VN")}đ qua VNPay.`,
          type: "BOOKING",
          link: "/profile?tab=bookings",
        },
      }).catch(() => {});
      sendUserEmail(
        Number(userId),
        "Đặt sân thành công — SportHub AI",
        emailBookingConfirmed(
          userInfo?.fullName ?? "",
          booking.id,
          courtInfo?.name ?? `#${courtId}`,
          new Date(bookingDate).toLocaleDateString("vi-VN"),
          startTime,
          endTime,
          Number(totalPrice)
        )
      );

      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/booking-success?id=${booking.id}`);
    } catch (error) {
      console.error(error);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/bookings?error=booking_failed`);
    }
  }

  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/bookings?error=payment_failed`);
}
