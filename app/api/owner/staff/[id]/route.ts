import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/owner/staff/[staffRecordId] - Khóa / Mở khóa tài khoản nhân viên
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;

  const record = await prisma.facilityStaff.findFirst({
    where: { id: Number(id), facility: { ownerId } },
    include: { user: { select: { id: true, isLocked: true } } },
  });
  if (!record) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const newLocked = !record.user.isLocked;
  await prisma.user.update({
    where: { id: record.user.id },
    data: { isLocked: newLocked },
  });

  return NextResponse.json({ success: true, isLocked: newLocked });
}
