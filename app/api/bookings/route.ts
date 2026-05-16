import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendUserEmail, emailBookingConfirmed } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await req.json();
    const {
      courtId,
      bookingDate,
      startTime,
      endTime,
      totalPrice,
      serviceIds, // [{ id, quantity }]
      voucherCode,
    } = body;

    // 0. Kiểm tra khung giờ không nằm trong quá khứ
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayVN = nowVN.toISOString().split("T")[0];
    if (bookingDate === todayVN) {
      const [sh, sm] = startTime.split(":").map(Number);
      const slotMinutes = sh * 60 + sm;
      const nowMinutes = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
      if (slotMinutes < nowMinutes) {
        return NextResponse.json({ error: "Không thể đặt sân cho khung giờ đã qua!" }, { status: 400 });
      }
    }

    // 1. Kiểm tra sân tồn tại
    const court = await prisma.court.findUnique({
      where: { id: Number(courtId) },
      include: { facility: { select: { ownerId: true, name: true } } },
    });
    if (!court) {
      return NextResponse.json({ error: "Sân không tồn tại" }, { status: 404 });
    }

    // 2. Kiểm tra trùng lịch
    const conflict = await prisma.booking.findFirst({
      where: {
        courtId: Number(courtId),
        bookingDate: new Date(bookingDate),
        status: { notIn: ["CANCELLED"] },
        OR: [
          {
            startTime: { lte: new Date(`1970-01-01T${endTime}:00.000Z`) },
            endTime: { gte: new Date(`1970-01-01T${startTime}:00.000Z`) },
          },
        ],
      },
    });
    if (conflict) {
      return NextResponse.json({ error: "Khung giờ này đã được đặt!" }, { status: 409 });
    }

    // 3. Kiểm tra voucher nếu có
    let voucherId = null;
    let discountAmount = 0;
    if (voucherCode) {
      const voucher = await prisma.voucher.findFirst({
        where: {
            code: voucherCode,
            isActive: true,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
        },
        });
     if (!voucher || voucher.usedCount >= voucher.usageLimit) {
            return NextResponse.json({ error: "Voucher không hợp lệ hoặc đã hết hạn" }, { status: 400 });
         }
      voucherId = voucher.id;
      if (voucher.discountType === "PERCENT") {
        discountAmount = (Number(totalPrice) * Number(voucher.discountValue)) / 100;
        if (voucher.maxDiscount && discountAmount > Number(voucher.maxDiscount)) {
          discountAmount = Number(voucher.maxDiscount);
        }
      } else {
        discountAmount = Number(voucher.discountValue);
      }
    }

    // 4. Kiểm tra số dư ví
    const finalTotal = Number(totalPrice) - discountAmount;
    const wallet = await prisma.wallet.findUnique({
      where: { userId: Number((session.user as any).id) },
    });
    if (!wallet || Number(wallet.balance) < finalTotal) {
      return NextResponse.json({ error: "Số dư ví không đủ!" }, { status: 400 });
    }

    // 5. Tạo booking + trừ ví + cập nhật voucher (transaction)
    const result = await prisma.$transaction(async (tx) => {
      // Tạo booking
      const booking = await tx.booking.create({
        data: {
          courtId: Number(courtId),
          customerId: Number((session.user as any).id),
          bookingDate: new Date(bookingDate),
          startTime: new Date(`1970-01-01T${startTime}:00.000Z`),
          endTime: new Date(`1970-01-01T${endTime}:00.000Z`),
          totalPrice: finalTotal,
          status: "CONFIRMED",
          paymentStatus: "PAID",
          voucherId,
        },
      });

      // Tạo invoice
      const invoice = await tx.invoice.create({
        data: {
          bookingId: booking.id,
          subTotal: Number(totalPrice),
          discountAmount,
          finalTotal,
          paymentMethod: "WALLET",
        },
      });

      // Thêm dịch vụ kèm vào invoice
      if (serviceIds && serviceIds.length > 0) {
        for (const item of serviceIds) {
          const service = await tx.service.findUnique({ where: { id: item.id } });
          if (service) {
            await tx.invoiceItem.create({
              data: {
                invoiceId: invoice.id,
                serviceId: item.id,
                quantity: item.quantity,
                price: Number(service.price) * item.quantity,
              },
            });
            // Trừ tồn kho
            await tx.service.update({
              where: { id: item.id },
              data: { stockQuantity: { decrement: item.quantity } },
            });
          }
        }
      }

      // Trừ ví
      await tx.wallet.update({
        where: { userId: Number((session.user as any).id) },
        data: { balance: { decrement: finalTotal } },
      });

      // Ghi lịch sử giao dịch
      await tx.walletTransaction.create({
        data: {
          walletId: wallet!.id,
          amount: finalTotal,
          type: "PAYMENT",
          description: `Đặt sân #${booking.id}`,
        },
      });

      // Tăng usedCount voucher
      if (voucherId) {
        await tx.voucher.update({
          where: { id: voucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return booking;
    });

    // Gửi email xác nhận (fire & forget)
    const userId = Number((session.user as any).id);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const courtInfo = await prisma.court.findUnique({ where: { id: Number(courtId) }, select: { name: true } });
    // Thông báo 1: Đặt sân thành công (BOOKING)
    prisma.notification.create({
      data: {
        userId,
        title: "Đặt sân thành công",
        content: `Sân ${courtInfo?.name ?? ""} ngày ${new Date(bookingDate).toLocaleDateString("vi-VN")} lúc ${startTime}–${endTime}. Mã booking #${result.id}.`,
        type: "BOOKING",
        link: "/profile?tab=bookings",
      },
    }).catch(() => {});

    // Thông báo 2: Ví bị trừ tiền (PAYMENT)
    const walletAfter = Number(wallet!.balance) - finalTotal;
    prisma.notification.create({
      data: {
        userId,
        title: "Ví SportHub bị trừ tiền",
        content: `Đã trừ ${finalTotal.toLocaleString("vi-VN")}đ cho booking #${result.id}. Số dư còn lại: ${walletAfter.toLocaleString("vi-VN")}đ.`,
        type: "PAYMENT",
        link: "/profile?tab=wallet",
      },
    }).catch(() => {});

    // Thông báo cho chủ sân
    if (court.facility) {
      prisma.notification.create({
        data: {
          userId: court.facility.ownerId,
          title: `Đơn đặt sân mới — ${court.facility.name}`,
          content: `${user?.fullName ?? "Khách hàng"} đặt sân ${courtInfo?.name ?? ""} ngày ${new Date(bookingDate).toLocaleDateString("vi-VN")} · ${startTime}–${endTime} · ${finalTotal.toLocaleString("vi-VN")}đ`,
          type: "BOOKING",
          link: "/owner/dashboard",
        },
      }).catch(() => {});
    }

    sendUserEmail(
      userId,
      "Đặt sân thành công — SportHub AI",
      emailBookingConfirmed(
        user?.fullName ?? "",
        result.id,
        courtInfo?.name ?? `#${courtId}`,
        new Date(bookingDate).toLocaleDateString("vi-VN"),
        startTime,
        endTime,
        finalTotal
      )
    );

    return NextResponse.json({
      success: true,
      bookingId: result.id,
      message: "Đặt sân thành công!",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}