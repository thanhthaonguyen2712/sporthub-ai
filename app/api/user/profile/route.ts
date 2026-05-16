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

    const userId = Number((session.user as any).id);
    const { fullName, phone, email } = await req.json();

    // Kiểm tra số điện thoại không trùng với tài khoản khác
    if (phone) {
      const existing = await prisma.user.findFirst({
        where: { phone, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "Số điện thoại đã được sử dụng bởi tài khoản khác" }, { status: 400 });
      }
    }

    // Kiểm tra email không trùng với tài khoản khác
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "Email đã được sử dụng bởi tài khoản khác" }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(email && { email }),
      },
      select: { fullName: true, email: true, phone: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}