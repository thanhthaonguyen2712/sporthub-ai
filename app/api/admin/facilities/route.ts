import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const facilities = await prisma.facility.findMany({
    orderBy: { id: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true, phone: true } },
      facilitySports: { include: { sportCategory: { select: { name: true } } } },
      _count: { select: { courts: true, facilityStaff: true } },
    },
  });

  return NextResponse.json(facilities);
}
