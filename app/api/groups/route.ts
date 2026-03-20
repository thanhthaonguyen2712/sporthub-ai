import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const userId = Number((session.user as any).id);

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        owner: { select: { fullName: true, email: true } },
        members: {
          include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { name, description } = await req.json();
    if (!name) return NextResponse.json({ error: "Thiếu tên nhóm" }, { status: 400 });

    const userId = Number((session.user as any).id);

    const group = await prisma.group.create({
      data: {
        name,
        description,
        ownerId: userId,
        members: {
          create: { userId, role: "OWNER" },
        },
      },
      include: {
        owner: { select: { fullName: true } },
        members: {
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({ success: true, group });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}