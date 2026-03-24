import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUserEmail, emailCoursePaymentReminder } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    in3Days.setHours(23, 59, 59, 999);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const results = { reminded: 0, charged: 0, failed: 0, completed: 0, errors: 0 };

    // --- 1. Gửi nhắc nhở 3 ngày trước hạn đóng học phí ---
    const upcomingEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDate: { gte: tomorrow, lte: in3Days },
      },
      include: {
        course: true,
        user: { include: { wallet: true } },
      },
    });

    for (const enrollment of upcomingEnrollments) {
      try {
        const dueDate = enrollment.nextPaymentDate!;
        const dueDateStr = dueDate.toLocaleDateString("vi-VN");
        const price = Number(enrollment.course.price);
        const balance = Number(enrollment.user.wallet?.balance ?? 0);
        const isInsufficient = balance < price;

        await prisma.notification.create({
          data: {
            userId: enrollment.userId,
            title: "Sắp đến hạn đóng học phí",
            content: isInsufficient
              ? `Học phí tháng tới của khóa "${enrollment.course.title}" là ${price.toLocaleString("vi-VN")}đ, đến hạn ngày ${dueDateStr}. Số dư ví hiện tại (${balance.toLocaleString("vi-VN")}đ) không đủ — vui lòng nạp thêm tiền!`
              : `Học phí tháng tới của khóa "${enrollment.course.title}" là ${price.toLocaleString("vi-VN")}đ, sẽ được tự động trừ vào ngày ${dueDateStr}.`,
            type: "COURSE",
            link: "/profile?tab=courses",
          },
        });
        sendUserEmail(
          enrollment.userId,
          `Nhắc nhở học phí — ${enrollment.course.title}`,
          emailCoursePaymentReminder(
            enrollment.user.fullName,
            enrollment.course.title,
            price,
            dueDateStr,
            isInsufficient,
            balance
          )
        );
        results.reminded++;
      } catch {
        results.errors++;
      }
    }

    // --- 2. Tự động thu học phí khi đến hạn ---
    const dueEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDate: { lte: tomorrow },
      },
      include: {
        course: true,
        user: { include: { wallet: true } },
      },
    });

    for (const enrollment of dueEnrollments) {
      try {
        const price = Number(enrollment.course.price);
        const wallet = enrollment.user.wallet;
        const courseEndDate = new Date(enrollment.course.endDate);
        courseEndDate.setHours(23, 59, 59, 999);

        // Khóa học đã kết thúc → đánh dấu hoàn thành, không thu phí
        if (today > courseEndDate) {
          await prisma.courseEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED", nextPaymentDate: null },
          });
          await prisma.notification.create({
            data: {
              userId: enrollment.userId,
              title: "Khóa học đã kết thúc",
              content: `Khóa học "${enrollment.course.title}" đã kết thúc. Chúc mừng bạn đã hoàn thành!`,
              type: "COURSE",
              link: "/profile?tab=courses",
            },
          });
          results.completed++;
          continue;
        }

        if (!wallet || wallet.status !== "ACTIVE" || Number(wallet.balance) < price) {
          // Ví không đủ → gửi thông báo khẩn
          await prisma.notification.create({
            data: {
              userId: enrollment.userId,
              title: "Không thể thu học phí — Số dư ví không đủ",
              content: `Học phí tháng này của khóa "${enrollment.course.title}" là ${price.toLocaleString("vi-VN")}đ nhưng số dư ví không đủ. Vui lòng nạp tiền để tiếp tục khóa học.`,
              type: "COURSE",
              link: "/profile?tab=wallet",
            },
          });
          results.failed++;
          continue;
        }

        // Đủ tiền → trừ ví và cập nhật ngày thanh toán tiếp theo
        const nextPaymentDate = new Date(enrollment.nextPaymentDate!);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

        await prisma.$transaction(async (tx) => {
          await tx.courseEnrollment.update({
            where: { id: enrollment.id },
            data: { paidAt: now, nextPaymentDate },
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
              description: `Học phí tháng ${now.getMonth() + 1}/${now.getFullYear()} — ${enrollment.course.title}`,
            },
          });
          await tx.notification.create({
            data: {
              userId: enrollment.userId,
              title: "Đã thu học phí tháng này",
              content: `Học phí ${price.toLocaleString("vi-VN")}đ cho khóa "${enrollment.course.title}" đã được trừ. Kỳ tiếp theo: ${nextPaymentDate.toLocaleDateString("vi-VN")}.`,
              type: "COURSE",
              link: "/profile?tab=courses",
            },
          });
        });
        results.charged++;
      } catch {
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      processed: upcomingEnrollments.length + dueEnrollments.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
