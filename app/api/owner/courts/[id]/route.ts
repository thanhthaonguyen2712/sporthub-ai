import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const court = await prisma.court.findFirst({
    where: { id: Number(id), facility: { ownerId } },
  });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  await prisma.court.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
