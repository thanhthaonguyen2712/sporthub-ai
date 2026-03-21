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
  const period = searchParams.get("period") || "month"; // "week" | "month"
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, ownerId },
    include: { courts: { where: { isActive: true }, select: { id: true, name: true } } },
  });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const courtIds = facility.courts.map((c) => c.id);

  const bookings = await prisma.booking.findMany({
    where: {
      courtId: { in: courtIds },
      bookingDate: { gte: startDate, lte: endDate },
      status: { notIn: ["CANCELLED"] },
    },
    select: { bookingDate: true, startTime: true, endTime: true, courtId: true },
  });

  // Tỉ lệ lấp đầy theo ngày
  const daysInMonth = endDate.getDate();
  const dailyStats = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    const dayBookings = bookings.filter(
      (b) => new Date(b.bookingDate).getDate() === i + 1
    );
    const totalSlots = courtIds.length * 16; // 16 khung giờ/ngày mỗi sân
    const bookedSlots = dayBookings.length;
    return {
      day: i + 1,
      date: date.toISOString().split("T")[0],
      bookedSlots,
      totalSlots,
      rate: totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0,
    };
  });

  // Tỉ lệ lấp đầy theo khung giờ
  const hourlyStats: Record<string, number> = {};
  bookings.forEach((b) => {
    const hour = new Date(b.startTime).getUTCHours();
    const key = `${String(hour).padStart(2, "0")}:00`;
    hourlyStats[key] = (hourlyStats[key] || 0) + 1;
  });

  // Tỉ lệ theo sân
  const courtStats = facility.courts.map((c) => {
    const count = bookings.filter((b) => b.courtId === c.id).length;
    return { courtId: c.id, courtName: c.name, bookingCount: count };
  });

  return NextResponse.json({ dailyStats, hourlyStats, courtStats, month, year });
}
