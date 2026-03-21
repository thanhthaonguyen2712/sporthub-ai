import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { searchParams } = req.nextUrl;
  const facilityId = Number(searchParams.get("facilityId"));
  const period = searchParams.get("period") || "month";
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, ownerId },
    include: {
      courts: {
        where: { isActive: true },
        select: { id: true, name: true, category: { select: { name: true } } },
      },
    },
  });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const courtIds = facility.courts.map((c) => c.id);

  // ── Yearly view ─────────────────────────────────────────────────────────────
  if (period === "year") {
    const yearBookings = await prisma.booking.findMany({
      where: {
        courtId: { in: courtIds },
        bookingDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
        status: { notIn: ["CANCELLED"] },
      },
      select: { bookingDate: true },
    });
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const count = yearBookings.filter((b) => new Date(b.bookingDate).getMonth() === i).length;
      const daysInMonth = new Date(year, i + 1, 0).getDate();
      const totalSlots = courtIds.length * 16 * daysInMonth;
      return {
        month: i + 1,
        count,
        rate: totalSlots > 0 ? Math.round((count / totalSlots) * 100) : 0,
      };
    });
    return NextResponse.json({ monthlyStats });
  }

  // ── Monthly view ─────────────────────────────────────────────────────────────
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      courtId: { in: courtIds },
      bookingDate: { gte: startDate, lte: endDate },
      status: { notIn: ["CANCELLED"] },
    },
    select: { bookingDate: true, startTime: true, courtId: true },
  });

  // Daily stats
  const daysInMonth = endDate.getDate();
  const dailyStats = Array.from({ length: daysInMonth }, (_, i) => {
    const count = bookings.filter((b) => new Date(b.bookingDate).getDate() === i + 1).length;
    const totalSlots = courtIds.length * 16;
    return {
      day: i + 1,
      count,
      rate: totalSlots > 0 ? Math.round((count / totalSlots) * 100) : 0,
    };
  });

  // Hourly stats
  const hourlyMap: Record<string, number> = {};
  bookings.forEach((b) => {
    const hour = new Date(b.startTime).getUTCHours();
    const key = `${String(hour).padStart(2, "0")}:00`;
    hourlyMap[key] = (hourlyMap[key] || 0) + 1;
  });
  const hourlyStats = Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour, count }));

  // Court stats
  const courtStats = facility.courts.map((c) => ({
    courtId: c.id,
    courtName: c.name,
    count: bookings.filter((b) => b.courtId === c.id).length,
  }));

  // Sport stats
  const sportMap: Record<string, number> = {};
  facility.courts.forEach((c) => {
    const sport = c.category?.name || "Khác";
    const count = bookings.filter((b) => b.courtId === c.id).length;
    sportMap[sport] = (sportMap[sport] || 0) + count;
  });
  const sportStats = Object.entries(sportMap).map(([name, count]) => ({ name, count }));

  return NextResponse.json({ dailyStats, hourlyStats, courtStats, sportStats, month, year });
}
