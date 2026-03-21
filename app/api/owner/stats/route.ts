import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const facilities = await prisma.facility.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const facilityIds = facilities.map((f) => f.id);

  const [staffCount, monthlyBookings, revenueAgg] = await Promise.all([
    prisma.facilityStaff.count({ where: { facilityId: { in: facilityIds } } }),
    prisma.booking.count({
      where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: startOfMonth } },
    }),
    prisma.invoice.aggregate({
      where: {
        booking: { court: { facilityId: { in: facilityIds } } },
        createdAt: { gte: startOfMonth },
      },
      _sum: { finalTotal: true },
    }),
  ]);

  return NextResponse.json({
    facilityCount: facilities.length,
    staffCount,
    monthlyBookings,
    monthlyRevenue: Number(revenueAgg._sum.finalTotal || 0),
  });
}
