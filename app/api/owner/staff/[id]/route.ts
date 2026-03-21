import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/owner/staff/[staffRecordId] - Xóa nhân viên khỏi cơ sở
export async function DELETE(
  _req: NextRequest,
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
  });
  if (!record) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  await prisma.facilityStaff.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
