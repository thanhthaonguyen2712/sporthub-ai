import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(params.id);
  if (userId === Number((session.user as any).id)) {
    return NextResponse.json({ error: "Không thể tự khóa tài khoản của mình." }, { status: 400 });
  }

  const { isLocked } = await req.json();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isLocked: Boolean(isLocked) },
    select: { id: true, fullName: true, isLocked: true },
  });

  return NextResponse.json({ success: true, user });
}
