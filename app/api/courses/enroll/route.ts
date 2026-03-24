import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendUserEmail, emailCourseEnrolled } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { courseId, paymentMethod } = await req.json();
    const userId = Number((session.user as any).id);

    const course = await prisma.course.findUnique({ where: { id: Number(courseId) } });
    if (!course) return NextResponse.json({ error: "Khóa học không tồn tại" }, { status: 404 });

    // Kiểm tra đã đăng ký chưa
    const existing = await prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: Number(courseId), userId } },
    });
    if (existing) return NextResponse.json({ error: "Bạn đã đăng ký khóa học này!" }, { status: 400 });

    // Kiểm tra số lượng
    const count = await prisma.courseEnrollment.count({ where: { courseId: Number(courseId) } });
    if (count >= course.maxStudents) return NextResponse.json({ error: "Khóa học đã đầy!" }, { status: 400 });

    if (paymentMethod === "WALLET") {
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.status !== "ACTIVE") {
        return NextResponse.json({ error: "Ví không hợp lệ hoặc bị khóa!" }, { status: 400 });
      }
      if (Number(wallet.balance) < Number(course.price)) {
        return NextResponse.json({
          error: `Số dư ví không đủ! Cần ${Number(course.price).toLocaleString("vi-VN")}đ, hiện có ${Number(wallet.balance).toLocaleString("vi-VN")}đ`,
        }, { status: 400 });
      }

      const now = new Date();
      const nextPaymentDate = new Date(now);
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

      await prisma.$transaction(async (tx) => {
        await tx.courseEnrollment.create({
          data: {
            courseId: Number(courseId),
            userId,
            status: "ACTIVE",
            paidAt: now,
            nextPaymentDate,
          },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: Number(course.price) } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: Number(course.price),
            type: "PAYMENT",
            description: `Đăng ký khóa học: ${course.title}`,
          },
        });
      });

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
      prisma.notification.create({
        data: {
          userId,
          title: `Đăng ký khóa học thành công`,
          content: `Bạn đã đăng ký khóa "${course.title}". Học phí ${Number(course.price).toLocaleString("vi-VN")}đ đã được trừ. Kỳ thanh toán tiếp theo: ${nextPaymentDate.toLocaleDateString("vi-VN")}.`,
          type: "COURSE",
          link: "/profile?tab=courses",
        },
      }).catch(() => {});
      sendUserEmail(
        userId,
        `Đăng ký khóa học thành công — ${course.title}`,
        emailCourseEnrolled(
          user?.fullName ?? "",
          course.title,
          course.schedule,
          new Date(course.startDate).toLocaleDateString("vi-VN"),
          new Date(course.endDate).toLocaleDateString("vi-VN"),
          Number(course.price),
          nextPaymentDate.toLocaleDateString("vi-VN")
        )
      );

      return NextResponse.json({ success: true, message: "Đăng ký thành công!" });
    }

    // VNPay
    return NextResponse.json({ error: "Phương thức thanh toán không hợp lệ" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}