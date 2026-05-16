import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailAdminBroadcast } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const role = (session.user as any).role;
    if (role !== "OWNER") {
      return NextResponse.json({ error: "Không có quyền gửi thông báo" }, { status: 403 });
    }

    const { title, content, type, targetRole, link } = await req.json();

    // Lấy danh sách user theo role
    const users = await prisma.user.findMany({
      where: targetRole === "ALL" ? {} : { role: targetRole },
      select: { id: true, email: true, fullName: true, notifEmail: true },
    });

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title,
        content,
        type: type || "SYSTEM",
        link: link || null,
      })),
    });

    // Gửi email cho những user bật notifEmail
    for (const u of users) {
      if (!u.notifEmail) continue;
      sendEmail(
        u.email,
        `${title} — SportHub AI`,
        emailAdminBroadcast(u.fullName, title, content)
      );
    }

    return NextResponse.json({ success: true, sent: users.length });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}