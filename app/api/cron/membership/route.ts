import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserEmail, emailMembershipReminder } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    in3Days.setHours(23, 59, 59, 999);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const MEMBERSHIP_PRICES: Record<string, number> = {
      SILVER: 199000,
      GOLD: 399000,
      PLATINUM: 699000,
    };

    const results = { renewed: 0, cancelled: 0, reminded: 0, errors: 0 };

    // --- 1. Gửi nhắc nhở 3 ngày trước hết hạn ---
    const upcomingExpiry = await prisma.membership.findMany({
      where: {
        status: "ACTIVE",
        tier: { not: "FREE" },
        endDate: { gte: tomorrow, lte: in3Days },
      },
      include: { user: { include: { wallet: true } } },
    });

    for (const membership of upcomingExpiry) {
      try {
        const price = MEMBERSHIP_PRICES[membership.tier];
        const balance = Number(membership.user.wallet?.balance ?? 0);
        const isInsufficient = balance < price;
        const endDateStr = membership.endDate!.toLocaleDateString("vi-VN");

        await prisma.notification.create({
          data: {
            userId: membership.userId,
            title: "Gói hội viên sắp hết hạn",
            content: isInsufficient
              ? `Gói ${membership.tier} hết hạn ngày ${endDateStr}. Số dư ví không đủ để gia hạn — vui lòng nạp thêm!`
              : `Gói ${membership.tier} sẽ tự động gia hạn vào ngày ${endDateStr}.`,
            type: "MEMBERSHIP",
            link: "/profile?tab=membership",
          },
        });

        sendUserEmail(
          membership.userId,
          `Nhắc nhở gia hạn gói ${membership.tier} — SportHub AI`,
          emailMembershipReminder(
            membership.user.fullName,
            membership.tier,
            price,
            endDateStr,
            isInsufficient,
            balance
          )
        );
        results.reminded++;
      } catch {
        results.errors++;
      }
    }

    // --- 2. Xử lý các gói đã hết hạn ---
    const expiredMemberships = await prisma.membership.findMany({
      where: {
        status: "ACTIVE",
        tier: { not: "FREE" },
        endDate: { lte: today },
      },
      include: { user: { include: { wallet: true } } },
    });

    for (const membership of expiredMemberships) {
      const price = MEMBERSHIP_PRICES[membership.tier];
      const wallet = membership.user.wallet;

      if (wallet && Number(wallet.balance) >= price && membership.status === "ACTIVE") {
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
            await tx.notification.create({
              data: {
                userId: membership.userId,
                title: "Gói hội viên đã được gia hạn",
                content: `Gói ${membership.tier} của bạn đã được tự động gia hạn đến ${newEnd.toLocaleDateString("vi-VN")}. Đã trừ ${price.toLocaleString("vi-VN")}đ.`,
                type: "MEMBERSHIP",
                link: "/profile?tab=membership",
              },
            });
          });

          sendUserEmail(
            membership.userId,
            `Gia hạn gói ${membership.tier} thành công — SportHub AI`,
            emailMembershipReminder(
              membership.user.fullName,
              membership.tier,
              price,
              newEnd.toLocaleDateString("vi-VN"),
              false,
              Number(wallet.balance) - price
            )
          );
          results.renewed++;
        } catch {
          results.errors++;
        }
      } else {
        // Không đủ tiền hoặc đã hủy gia hạn → hủy về FREE
        await prisma.membership.update({
          where: { id: membership.id },
          data: { tier: "FREE", status: "ACTIVE" },
        });
        await prisma.notification.create({
          data: {
            userId: membership.userId,
            title: "Gói hội viên đã bị hạ cấp",
            content: `Gói ${membership.tier} đã hết hạn và không đủ số dư để gia hạn. Tài khoản của bạn đã về gói FREE.`,
            type: "MEMBERSHIP",
            link: "/profile?tab=membership",
          },
        });
        sendUserEmail(
          membership.userId,
          `Gói hội viên ${membership.tier} đã hết hạn — SportHub AI`,
          emailMembershipReminder(
            membership.user.fullName,
            membership.tier,
            price,
            today.toLocaleDateString("vi-VN"),
            true,
            Number(membership.user.wallet?.balance ?? 0)
          )
        );
        results.cancelled++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      processed: expiredMemberships.length + upcomingExpiry.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
