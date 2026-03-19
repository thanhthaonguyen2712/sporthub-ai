import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      if (!wallet || Number(wallet.balance) < Number(course.price)) {
        return NextResponse.json({ error: "Số dư ví không đủ!" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.courseEnrollment.create({
          data: { courseId: Number(courseId), userId, status: "ACTIVE", paidAt: new Date() },
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

      return NextResponse.json({ success: true, message: "Đăng ký thành công!" });
    }

    // VNPay
    return NextResponse.json({ error: "Phương thức thanh toán không hợp lệ" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}