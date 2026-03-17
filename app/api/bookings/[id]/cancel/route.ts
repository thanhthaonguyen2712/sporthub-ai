import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const bookingId = Number(id);

    // Tìm booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Không tìm thấy booking" }, { status: 404 });
    }

    // Kiểm tra quyền
    if (booking.customerId !== Number((session.user as any).id)) {
      return NextResponse.json({ error: "Không có quyền hủy" }, { status: 403 });
    }

    // Kiểm tra status
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking đã bị hủy trước đó" }, { status: 400 });
    }

    if (booking.status === "COMPLETED") {
      return NextResponse.json({ error: "Không thể hủy booking đã hoàn thành" }, { status: 400 });
    }

    // Kiểm tra 60 phút kể từ khi đặt
    const now = new Date();
    const createdAt = new Date(booking.createdAt);
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (diffMinutes > 60) {
      return NextResponse.json({
        error: "Đã quá 60 phút kể từ khi đặt sân, không thể hủy!",
      }, { status: 400 });
    }

    // Hủy + hoàn tiền (transaction)
    const refundAmount = Number(booking.totalPrice);

    await prisma.$transaction(async (tx) => {
      // Đổi status booking
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED", paymentStatus: "UNPAID" },
      });

      // Hoàn tiền về ví nếu đã thanh toán bằng ví
      if (booking.paymentStatus === "PAID" && booking.invoice?.paymentMethod === "WALLET") {
        const wallet = await tx.wallet.findUnique({
          where: { userId: Number((session.user as any).id) },
        });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: refundAmount } },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amount: refundAmount,
              type: "REFUND",
              description: `Hoàn tiền hủy sân #${bookingId}`,
            },
          });
        }
      }
    });
    return NextResponse.json({
      success: true,
      refunded: booking.paymentStatus === "PAID",
      refundAmount,
      message: booking.paymentStatus === "PAID"
        ? `Hủy thành công! Hoàn ${refundAmount.toLocaleString("vi-VN")}đ về ví.`
        : "Hủy sân thành công!",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}