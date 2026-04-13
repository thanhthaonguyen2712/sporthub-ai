import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/owner/courts/[id]/schedule?startDate=&endDate=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const courtId = Number(id);
  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { ownerId } },
    include: { pricingRules: true },
  });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const [bookings, guestBookings, locks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        courtId,
        ...(Object.keys(dateFilter).length ? { bookingDate: dateFilter } : {}),
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      },
      include: {
        customer: { select: { fullName: true, phone: true } },
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.guestBooking.findMany({
      where: {
        courtId,
        ...(Object.keys(dateFilter).length ? { bookingDate: dateFilter } : {}),
        status: { in: ["CONFIRMED", "PAID"] },
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.courtLock.findMany({
      where: { courtId, isActive: true },
    }),
  ]);

  return NextResponse.json({
    court: { id: court.id, name: court.name, pricingRules: court.pricingRules },
    bookings,
    guestBookings,
    locks,
  });
}
