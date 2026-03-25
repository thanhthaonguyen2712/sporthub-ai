import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: danh sách bài đăng tìm đồng đội
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "OPEN") as "OPEN" | "CLOSED" | "EXPIRED";

    const posts = await prisma.matchPost.findMany({
      where: { status },
      include: {
        facility: { select: { id: true, name: true, address: true } },
        category: { select: { id: true, name: true, iconUrl: true } },
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: [{ matchDate: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        matchDate: p.matchDate,
        startTime: p.startTime.toISOString().slice(11, 16),
        endTime: p.endTime.toISOString().slice(11, 16),
        level: p.level,
        status: p.status,
        requiredPlayers: p.requiredPlayers,
        joinedPlayers: p.joinedPlayers,
        remaining: p.requiredPlayers - p.joinedPlayers,
        facility: p.facility,
        sport: p.category,
        creator: p.creator,
        createdAt: p.createdAt,
        courtName: p.courtName ?? null,
        pricePerPerson: p.pricePerPerson ? Number(p.pricePerPerson) : null,
        totalPrice: p.totalPrice ? Number(p.totalPrice) : null,
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// POST: tạo bài đăng tìm đồng đội mới
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const {
      title,
      description,
      matchDate,
      startTime,
      endTime,
      level,
      requiredPlayers,
      facilityId,
      categoryId,
      bookingId,
      courtName,
      totalPrice,
    } = await req.json();

    if (!matchDate || !startTime || !endTime || !level || !requiredPlayers || !facilityId || !categoryId) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const creatorId = Number((session.user as any).id);

    const startTimeDate = new Date(`1970-01-01T${startTime}:00`);
    const endTimeDate = new Date(`1970-01-01T${endTime}:00`);

    const sport = await prisma.sportCategory.findUnique({ where: { id: Number(categoryId) }, select: { name: true } });
    const autoTitle = title?.trim() || `Tìm ${Number(requiredPlayers) - 1} người chơi ${sport?.name || ""}`;

    const numRequired = Number(requiredPlayers);
    const numTotal = totalPrice ? Number(totalPrice) : null;
    const pricePerPerson = numTotal && numRequired > 1 ? Math.ceil(numTotal / numRequired) : null;

    const post = await prisma.matchPost.create({
      data: {
        title: autoTitle,
        description: description?.trim() || null,
        matchDate: new Date(matchDate),
        startTime: startTimeDate,
        endTime: endTimeDate,
        level,
        requiredPlayers: numRequired,
        joinedPlayers: 1, // người tạo tính là 1
        creatorId,
        facilityId: Number(facilityId),
        categoryId: Number(categoryId),
        ...(bookingId ? { bookingId: Number(bookingId) } : {}),
        ...(courtName ? { courtName: String(courtName) } : {}),
        ...(numTotal ? { totalPrice: numTotal } : {}),
        ...(pricePerPerson ? { pricePerPerson } : {}),
      },
      include: {
        facility: { select: { id: true, name: true, address: true } },
        category: { select: { id: true, name: true, iconUrl: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json(
      {
        ...post,
        startTime: post.startTime.toISOString().slice(11, 16),
        endTime: post.endTime.toISOString().slice(11, 16),
        sport: post.category,
        remaining: post.requiredPlayers - post.joinedPlayers,
        pricePerPerson: post.pricePerPerson ? Number(post.pricePerPerson) : null,
        totalPrice: post.totalPrice ? Number(post.totalPrice) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
