import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendUserEmail, emailWalletWithdraw } from "@/lib/email";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const userId = Number((session.user as any).id);
    const banks = await prisma.bankAccount.findMany({ where: { userId } });
    return NextResponse.json(banks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { amount, bankName, accountNumber, accountName, saveBank } = await req.json();

    if (!amount || amount < 10000) {
      return NextResponse.json({ error: "Số tiền tối thiểu là 10.000đ" }, { status: 400 });
    }

    const userId = Number((session.user as any).id);

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return NextResponse.json({ error: "Không tìm thấy ví" }, { status: 404 });
    if (Number(wallet.balance) < amount) {
      return NextResponse.json({ error: "Số dư không đủ!" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Trừ ví
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      // Ghi lịch sử
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: "WITHDRAW",
          description: `Rút tiền về ${bankName} - ${accountNumber}`,
        },
      });

      // Lưu tài khoản ngân hàng nếu chọn
      if (saveBank && bankName && accountNumber && accountName) {
        await tx.bankAccount.upsert({
          where: {
            // upsert theo accountNumber + userId
            id: (await tx.bankAccount.findFirst({
              where: { userId, accountNumber },
            }))?.id || 0,
          },
          update: { bankName, accountName },
          create: { userId, bankName, accountNumber, accountName },
        });
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }).catch(() => null);
    const newBalance = Number(wallet.balance) - amount;
    prisma.notification.create({
      data: {
        userId,
        title: "Rút tiền thành công",
        content: `Đã rút ${Number(amount).toLocaleString("vi-VN")}đ về ${bankName} - ${accountNumber}. Số dư còn: ${newBalance.toLocaleString("vi-VN")}đ.`,
        type: "PAYMENT",
        link: "/profile?tab=wallet",
      },
    }).catch(() => {});
    sendUserEmail(
      userId,
      "Rút tiền ví thành công — SportHub AI",
      emailWalletWithdraw(
        (user as any)?.fullName ?? "",
        amount,
        bankName,
        accountNumber,
        newBalance
      )
    );

    return NextResponse.json({
      success: true,
      message: `Rút ${Number(amount).toLocaleString("vi-VN")}đ về ${bankName} thành công!`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}