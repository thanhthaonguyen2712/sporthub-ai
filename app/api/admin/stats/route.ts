import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalUsers,
    usersByRole,
    totalFacilities,
    activeFacilities,
    totalBookings,
    revenueInvoice,
    revenueDirectSale,
    recentUsers,
    openReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.facility.count(),
    prisma.facility.count({ where: { isActive: true } }),
    prisma.booking.count(),
    prisma.invoice.aggregate({ _sum: { finalTotal: true } }),
    prisma.directSale.aggregate({ _sum: { finalTotal: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, fullName: true, email: true, role: true, isLocked: true, createdAt: true, avatar: true },
    }),
    prisma.staffReport.count({ where: { status: "OPEN" } }),
  ]);

  const totalRevenue =
    Number(revenueInvoice._sum.finalTotal ?? 0) +
    Number(revenueDirectSale._sum.finalTotal ?? 0);

  return NextResponse.json({
    totalUsers,
    usersByRole,
    totalFacilities,
    activeFacilities,
    totalBookings,
    totalRevenue,
    recentUsers,
    openReports,
  });
}
