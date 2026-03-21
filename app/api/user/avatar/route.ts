import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Không có file" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Ảnh không được vượt quá 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop();
    const fileName = `avatar_${(session.user as any).id}_${Date.now()}.${ext}`;
    const filePath = path.join(process.cwd(), "public", "uploads", "avatars", fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    await prisma.user.update({
      where: { id: Number((session.user as any).id) },
      data: { avatar: avatarUrl },
    });

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
