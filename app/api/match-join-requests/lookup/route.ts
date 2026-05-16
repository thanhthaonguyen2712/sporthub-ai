import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: tra cứu yêu cầu ghép trận của khách vãng lai theo SĐT
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone")?.trim();

  if (!phone) return NextResponse.json({ error: "Thiếu số điện thoại" }, { status: 400 });

  const requests = await (prisma as any).matchJoinRequest.findMany({
    where: { guestPhone: phone, userId: null },
    include: {
      matchPost: {
        include: {
          facility: { select: { name: true, address: true } },
          category: { select: { name: true, iconUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    requests.map((r: any) => ({
      id: r.id,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      status: r.status,
      createdAt: r.createdAt,
      matchPost: {
        title: r.matchPost.title,
        matchDate: r.matchPost.matchDate,
        startTime: r.matchPost.startTime.toISOString().slice(11, 16),
        endTime: r.matchPost.endTime.toISOString().slice(11, 16),
        facility: r.matchPost.facility,
        sport: r.matchPost.category,
        pricePerPerson: r.matchPost.pricePerPerson ? Number(r.matchPost.pricePerPerson) : null,
      },
    }))
  );
}
