import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: danh sách yêu cầu ghép trận của bản thân
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const userId = Number((session.user as any).id);

  const requests = await (prisma as any).matchJoinRequest.findMany({
    where: { userId },
    include: {
      matchPost: {
        include: {
          facility: { select: { name: true, address: true } },
          category: { select: { name: true, iconUrl: true } },
          creator: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    requests.map((r: any) => ({
      id: r.id,
      status: r.status,
      note: r.note,
      paymentProofUrl: r.paymentProofUrl,
      createdAt: r.createdAt,
      matchPost: {
        id: r.matchPost.id,
        title: r.matchPost.title,
        matchDate: r.matchPost.matchDate,
        startTime: r.matchPost.startTime.toISOString().slice(11, 16),
        endTime: r.matchPost.endTime.toISOString().slice(11, 16),
        pricePerPerson: r.matchPost.pricePerPerson ? Number(r.matchPost.pricePerPerson) : null,
        facility: r.matchPost.facility,
        sport: r.matchPost.category,
        creator: r.matchPost.creator,
        status: r.matchPost.status,
      },
    }))
  );
}
