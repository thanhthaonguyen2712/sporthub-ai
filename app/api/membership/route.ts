import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MEMBERSHIP_PRICES: Record<string, number> = {
  SILVER: 199000,
  GOLD: 399000,
  PLATINUM: 699000,
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const membership = await prisma.membership.findUnique({
      where: { userId: Number((session.user as any).id) },
    });

    return NextResponse.json(membership || { tier: "FREE", status: "ACTIVE" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { tier } = await req.json();
    const userId = Number((session.user as any).id);
    const price = MEMBERSHIP_PRICES[tier];

    if (!price) return NextResponse.json({ error: "Gói không hợp lệ" }, { status: 400 });

    // Kiểm tra số dư ví
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < price) {
      return NextResponse.json({ error: "Số dư ví không đủ!" }, { status: 400 });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await prisma.$transaction(async (tx) => {
      // Upsert membership
      await tx.membership.upsert({
        where: { userId },
        create: { userId, tier: tier as any, status: "ACTIVE", startDate, endDate },
        update: { tier: tier as any, status: "ACTIVE", startDate, endDate },
      });

      // Trừ ví
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: price } },
      });

      // Ghi lịch sử
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: price,
          type: "PAYMENT",
          description: `Nâng cấp gói hội viên ${tier}`,
        },
      });
    });

    return NextResponse.json({ success: true, message: `Nâng cấp lên ${tier} thành công!` });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const userId = Number((session.user as any).id);

    await prisma.membership.update({
      where: { userId },
      data: { status: "CANCELLED" }, 
    });

    return NextResponse.json({ success: true, message: "Đã hủy gia hạn tự động! Gói hiện tại vẫn có hiệu lực đến hết chu kỳ." });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}