import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: danh sách facilityId đã được đánh giá bởi user hiện tại
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ reviewed: [] });
  const customerId = Number((session.user as any).id);
  const reviews = await prisma.review.findMany({
    where: { customerId },
    select: { facilityId: true },
  });
  return NextResponse.json({ reviewed: reviews.map((r) => r.facilityId) });
}

// POST: gửi đánh giá cho cơ sở sau khi hoàn thành lịch thuê
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { facilityId, rating, comment } = await req.json();
    if (!facilityId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const customerId = Number((session.user as any).id);

    // Kiểm tra đã đánh giá chưa
    const existing = await prisma.review.findFirst({
      where: { customerId, facilityId: Number(facilityId) },
    });
    if (existing) {
      return NextResponse.json({ error: "Bạn đã đánh giá cơ sở này rồi" }, { status: 409 });
    }

    // Kiểm tra có lịch COMPLETED tại cơ sở này không
    const hasCompleted = await prisma.booking.findFirst({
      where: {
        customerId,
        status: "COMPLETED",
        court: { facilityId: Number(facilityId) },
      },
    });
    if (!hasCompleted) {
      return NextResponse.json(
        { error: "Bạn chưa có lịch đặt sân đã hoàn thành tại cơ sở này" },
        { status: 403 }
      );
    }

    const review = await prisma.review.create({
      data: {
        customerId,
        facilityId: Number(facilityId),
        rating: Number(rating),
        comment: comment?.trim() || null,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
