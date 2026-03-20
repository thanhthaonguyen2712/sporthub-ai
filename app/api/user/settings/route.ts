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
      select: { notifEmail: true, notifSms: true, notifPush: true, language: true },
    });

    return NextResponse.json(user || { notifEmail: true, notifSms: false, notifPush: true, language: "vi" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { notifEmail, notifSms, notifPush, language } = await req.json();

    await prisma.user.update({
      where: { id: Number((session.user as any).id) },
      data: { notifEmail, notifSms, notifPush, language },
    });

    return NextResponse.json({ success: true, message: "Lưu cài đặt thành công!" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}