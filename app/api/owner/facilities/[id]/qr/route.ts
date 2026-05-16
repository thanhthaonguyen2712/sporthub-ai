import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;

  const facility = await prisma.facility.findFirst({
    where: { id: Number(id), ownerId },
  });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  const { defaultQrUrl } = await req.json();

  await prisma.facility.update({
    where: { id: Number(id) },
    data: { defaultQrUrl: defaultQrUrl || null },
  });

  return NextResponse.json({ success: true });
}
