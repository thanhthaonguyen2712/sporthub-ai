import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Bảo mật - chỉ cho phép gọi từ cron job
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const MEMBERSHIP_PRICES: Record<string, number> = {
      SILVER: 199000,
      GOLD: 399000,
      PLATINUM: 699000,
    };

    // Tìm các membership hết hạn hôm nay và status ACTIVE (chưa hủy)
    const expiredMemberships = await prisma.membership.findMany({
      where: {
        status: "ACTIVE",
        tier: { not: "FREE" },
        endDate: { lte: today },
      },
      include: {
        user: {
          include: { wallet: true },
        },
      },
    });

    const results = { renewed: 0, cancelled: 0, errors: 0 };

    for (const membership of expiredMemberships) {
      const price = MEMBERSHIP_PRICES[membership.tier];
      const wallet = membership.user.wallet;

      if (wallet && Number(wallet.balance) >= price) {
        // Đủ tiền → gia hạn tự động
        const newStart = new Date();
        const newEnd = new Date();
        newEnd.setMonth(newEnd.getMonth() + 1);

        try {
          await prisma.$transaction(async (tx) => {
            await tx.membership.update({
              where: { id: membership.id },
              data: { startDate: newStart, endDate: newEnd, status: "ACTIVE" },
            });
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { decrement: price } },
            });
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                amount: price,
                type: "PAYMENT",
                description: `Tự động gia hạn gói ${membership.tier}`,
              },
            });
          });
          results.renewed++;
        } catch {
          results.errors++;
        }
      } else {
        // Không đủ tiền → hủy về FREE
        await prisma.membership.update({
          where: { id: membership.id },
          data: { tier: "FREE", status: "CANCELLED" },
        });
        results.cancelled++;
      }
    }

    return NextResponse.json({ success: true, ...results, processed: expiredMemberships.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
