import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await prisma.staffReport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      staff:    { select: { fullName: true, email: true } },
      facility: { select: { name: true } },
    },
  });

  return NextResponse.json(reports);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json();
  const report = await prisma.staffReport.update({
    where: { id: Number(id) },
    data: { status },
  });

  return NextResponse.json({ success: true, report });
}
