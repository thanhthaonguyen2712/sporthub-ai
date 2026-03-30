import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — lấy descriptor của user hiện tại
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { faceDescriptor: true },
  });

  return NextResponse.json({ faceDescriptor: user?.faceDescriptor ?? null });
}

// POST — lưu descriptor (mảng 128 số, JSON string)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { descriptor } = await req.json();
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json({ error: "Descriptor không hợp lệ" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { faceDescriptor: JSON.stringify(descriptor) },
  });

  return NextResponse.json({ success: true });
}

// DELETE — xóa descriptor
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  await prisma.user.update({
    where: { id: userId },
    data: { faceDescriptor: null },
  });

  return NextResponse.json({ success: true });
}
