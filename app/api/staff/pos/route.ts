import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/staff/pos - Tất cả sân trong cơ sở + booking đang diễn ra hôm nay
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json({ courts: [], services: [] });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // Tạo thời gian chỉ có HH:MM:SS để so sánh với db.Time
  const timeNow = new Date(`1970-01-01T${now.toTimeString().substring(0, 8)}`);

  const courts = await prisma.court.findMany({
    where: { facilityId: facilityStaff.facilityId, isActive: true },
    include: {
      category: { select: { name: true } },
      bookings: {
        where: {
          bookingDate: { gte: todayStart, lt: todayEnd },
          status: { notIn: ["CANCELLED"] },
        },
        include: {
          customer: { select: { fullName: true, phone: true } },
          invoice: {
            include: {
              items: { include: { service: { select: { name: true } } } },
            },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const services = await prisma.service.findMany({
    where: { facilityId: facilityStaff.facilityId, isActive: true, stockQuantity: { gt: 0 } },
    select: { id: true, name: true, type: true, price: true, stockQuantity: true },
    orderBy: { name: "asc" },
  });

  // Đánh dấu booking nào đang diễn ra ngay bây giờ
  const courtsWithStatus = courts.map((court) => {
    const activeBooking = court.bookings.find((b) => {
      const start = new Date(`1970-01-01T${new Date(b.startTime).toISOString().substring(11, 19)}`);
      const end = new Date(`1970-01-01T${new Date(b.endTime).toISOString().substring(11, 19)}`);
      return timeNow >= start && timeNow < end && b.status === "CONFIRMED";
    });
    const upcomingBookings = court.bookings.filter((b) => {
      const start = new Date(`1970-01-01T${new Date(b.startTime).toISOString().substring(11, 19)}`);
      return timeNow < start && b.status !== "CANCELLED";
    });
    return {
      id: court.id,
      name: court.name,
      category: court.category.name,
      activeBooking: activeBooking
        ? {
            id: activeBooking.id,
            startTime: activeBooking.startTime,
            endTime: activeBooking.endTime,
            totalPrice: activeBooking.totalPrice,
            isWalkIn: activeBooking.isWalkIn,
            createdByStaff: activeBooking.createdByStaff,
            walkInName: activeBooking.walkInName,
            customer: activeBooking.customer,
            invoice: activeBooking.invoice,
          }
        : null,
      upcomingCount: upcomingBookings.length,
    };
  });

  return NextResponse.json({ courts: courtsWithStatus, services });
}
