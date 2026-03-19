import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: Number((session.user as any).id) },
      select: { id: true, fullName: true, email: true, phone: true, avatar: true, createdAt: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { fullName, phone } = await req.json();

    const updated = await prisma.user.update({
      where: { id: Number((session.user as any).id) },
      data: {
        ...(fullName && { fullName }),
        ...(phone && { phone }),
      },
      select: { fullName: true, email: true, phone: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}