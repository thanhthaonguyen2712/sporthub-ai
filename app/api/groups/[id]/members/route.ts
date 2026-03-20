import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { id } = await params;
    const { email } = await req.json();

    // Tìm user theo email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Không tìm thấy người dùng!" }, { status: 404 });

    // Kiểm tra đã là thành viên chưa
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: Number(id), userId: user.id } },
    });
    if (existing) return NextResponse.json({ error: "Người dùng đã là thành viên!" }, { status: 400 });

    await prisma.groupMember.create({
      data: { groupId: Number(id), userId: user.id, role: "MEMBER" },
    });

    return NextResponse.json({ success: true, message: `Đã thêm ${user.fullName} vào nhóm!` });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { id } = await params;
    const { userId } = await req.json();

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: Number(id), userId: Number(userId) } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}