import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: chi tiết một bài đăng
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await (prisma as any).matchPost.findUnique({
    where: { id: Number(id) },
    include: {
      facility: { select: { id: true, name: true, address: true } },
      category: { select: { id: true, name: true, iconUrl: true } },
      creator: { select: { id: true, fullName: true, email: true } },
      joinRequests: {
        select: { id: true, status: true, userId: true, guestName: true },
      },
    },
  });
  if (!post) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  return NextResponse.json({
    ...post,
    startTime: post.startTime.toISOString().slice(11, 16),
    endTime: post.endTime.toISOString().slice(11, 16),
    sport: post.category,
    remaining: post.requiredPlayers - post.joinedPlayers,
    pricePerPerson: post.pricePerPerson ? Number(post.pricePerPerson) : null,
    totalPrice: post.totalPrice ? Number(post.totalPrice) : null,
  });
}

// PATCH: khóa/mở bài hoặc cập nhật mã QR (chỉ người tạo)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const userId = Number((session.user as any).id);

  const post = await (prisma as any).matchPost.findUnique({ where: { id: Number(id) } });
  if (!post) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  if (post.creatorId !== userId) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.isLocked === "boolean") data.isLocked = body.isLocked;
  if (body.qrCodeUrl !== undefined) data.qrCodeUrl = body.qrCodeUrl;
  if (body.title?.trim()) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.level) data.level = body.level;
  if (body.requiredPlayers) data.requiredPlayers = Number(body.requiredPlayers);

  const updated = await (prisma as any).matchPost.update({
    where: { id: Number(id) },
    data,
  });

  return NextResponse.json(updated);
}
