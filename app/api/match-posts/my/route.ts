import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: bài đăng tìm đồng đội do người dùng hiện tại tạo
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const creatorId = Number((session.user as any).id);

  const posts = await (prisma as any).matchPost.findMany({
    where: { creatorId },
    include: {
      facility: { select: { id: true, name: true, address: true } },
      category: { select: { id: true, name: true, iconUrl: true } },
      joinRequests: {
        select: { id: true, status: true, userId: true, guestName: true, guestPhone: true },
      },
    },
    orderBy: [{ matchDate: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(
    posts.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      matchDate: p.matchDate,
      startTime: p.startTime.toISOString().slice(11, 16),
      endTime: p.endTime.toISOString().slice(11, 16),
      level: p.level,
      status: p.status,
      isLocked: p.isLocked,
      requiredPlayers: p.requiredPlayers,
      joinedPlayers: p.joinedPlayers,
      remaining: p.requiredPlayers - p.joinedPlayers,
      pricePerPerson: p.pricePerPerson ? Number(p.pricePerPerson) : null,
      qrCodeUrl: p.qrCodeUrl ?? null,
      facility: p.facility,
      sport: p.category,
      createdAt: p.createdAt,
      joinRequests: p.joinRequests.map((r: any) => ({
        id: r.id,
        status: r.status,
        name: r.userId ? null : r.guestName,
        isGuest: !r.userId,
      })),
      pendingCount:  p.joinRequests.filter((r: any) => r.status === "PENDING").length,
      approvedCount: p.joinRequests.filter((r: any) => r.status === "APPROVED").length,
    }))
  );
}
