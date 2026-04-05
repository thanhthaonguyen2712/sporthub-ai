import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isActive } = await req.json();
  const facility = await prisma.facility.update({
    where: { id: Number(params.id) },
    data: { isActive: Boolean(isActive) },
    select: { id: true, name: true, isActive: true },
  });

  return NextResponse.json({ success: true, facility });
}
