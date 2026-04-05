import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search") || "";
  const role   = req.nextUrl.searchParams.get("role")   || "";
  const page   = Math.max(1, Number(req.nextUrl.searchParams.get("page") || "1"));
  const limit  = 20;

  const where: any = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email:    { contains: search } },
      { phone:    { contains: search } },
    ];
  }
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, fullName: true, email: true, phone: true,
        role: true, isLocked: true, createdAt: true, avatar: true,
        loyaltyPoint: true,
        _count: { select: { bookings: true, ownedFacilities: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
}
