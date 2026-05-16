import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: danh sách yêu cầu tham gia (chỉ người tạo bài)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const userId = Number((session.user as any).id);

  const post = await (prisma as any).matchPost.findUnique({ where: { id: Number(id) } });
  if (!post) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  if (post.creatorId !== userId) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const requests = await (prisma as any).matchJoinRequest.findMany({
    where: { matchPostId: Number(id) },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, avatar: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// POST: gửi yêu cầu tham gia (có tải ảnh bill)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const body = await req.json();
  const { paymentProofUrl, guestName, guestEmail, guestPhone } = body;

  const post = await (prisma as any).matchPost.findUnique({
    where: { id: Number(id) },
    include: { creator: { select: { id: true, email: true, fullName: true, notifEmail: true } } },
  });
  if (!post) return NextResponse.json({ error: "Không tìm thấy bài đăng" }, { status: 404 });
  if (post.status !== "OPEN") return NextResponse.json({ error: "Bài đăng đã đóng hoặc hết hạn" }, { status: 400 });
  if (post.isLocked) return NextResponse.json({ error: "Bài đăng đã bị khóa" }, { status: 400 });

  let joinerId: number | null = null;

  if (session) {
    joinerId = Number((session.user as any).id);
    if (post.creatorId === joinerId) {
      return NextResponse.json({ error: "Bạn là người tạo bài đăng này" }, { status: 400 });
    }
    // Kiểm tra đã gửi yêu cầu tham gia trước đó chưa
    const existing = await (prisma as any).matchJoinRequest.findFirst({
      where: { matchPostId: Number(id), userId: joinerId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (existing) return NextResponse.json({ error: "Bạn đã gửi yêu cầu tham gia rồi" }, { status: 400 });
  } else {
    // Khách vãng lai không đăng nhập
    if (!guestName || !guestPhone) {
      return NextResponse.json({ error: "Vui lòng nhập họ tên và số điện thoại" }, { status: 400 });
    }
  }

  const joinRequest = await (prisma as any).matchJoinRequest.create({
    data: {
      matchPostId: Number(id),
      userId: joinerId ?? undefined,
      guestName: joinerId ? undefined : guestName,
      guestEmail: joinerId ? undefined : (guestEmail || undefined),
      guestPhone: joinerId ? undefined : guestPhone,
      paymentProofUrl: paymentProofUrl || undefined,
      status: "PENDING",
    },
  });

  // Thông báo cho người tạo bài
  const requesterName = session ? (session.user as any).name : guestName;
  const matchDateStr = new Date(post.matchDate).toLocaleDateString("vi-VN");

  prisma.notification.create({
    data: {
      userId: post.creatorId,
      title: "Có người muốn tham gia ghép trận",
      content: `${requesterName} muốn tham gia bài đăng "${post.title}" ngày ${matchDateStr}. Vào trang tìm đồng đội để duyệt.`,
      type: "BOOKING",
      link: `/match-posts?tab=requests&post=${id}`,
    },
  }).catch(() => {});

  // Email cho người tạo
  if (post.creator.notifEmail) {
    const { sendEmail } = await import("@/lib/email");
    sendEmail(
      post.creator.email,
      `[SportHub] Yêu cầu ghép trận mới - ${post.title}`,
      `<p>Xin chào <b>${post.creator.fullName}</b>,</p>
       <p><b>${requesterName}</b> đã gửi yêu cầu tham gia bài đăng <b>"${post.title}"</b> ngày <b>${matchDateStr}</b>.</p>
       ${paymentProofUrl ? `<p>Họ đã tải lên ảnh xác nhận thanh toán. Vui lòng vào trang SportHub để xem và duyệt yêu cầu.</p>` : ""}
       <p style="color:#f59e0b;">⏳ Đăng nhập vào SportHub để xem ảnh bill và duyệt/từ chối yêu cầu.</p>`
    ).catch(() => {});
  }

  return NextResponse.json(joinRequest, { status: 201 });
}
