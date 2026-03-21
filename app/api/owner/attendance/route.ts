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
  const facilityId = searchParams.get("facilityId");
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  if (!facilityId) return NextResponse.json({ error: "Thiếu facilityId" }, { status: 400 });

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const staffList = await prisma.facilityStaff.findMany({
    where: { facilityId: Number(facilityId) },
    select: { userId: true, user: { select: { id: true, fullName: true, role: true } } },
  });

  const staffIds = staffList.map((s) => s.userId);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const records = await prisma.staffAttendance.findMany({
    where: {
      staffId: { in: staffIds },
      date: { gte: startDate, lte: endDate },
    },
    include: { staff: { select: { fullName: true } } },
    orderBy: [{ staffId: "asc" }, { date: "asc" }],
  });

  // Group by staff
  const byStaff = staffList.map((s) => {
    const staffRecords = records.filter((r) => r.staffId === s.userId);
    const totalHours = staffRecords.reduce((sum, r) => sum + Number(r.totalHours || 0), 0);
    const presentDays = staffRecords.filter((r) => r.status !== "ABSENT").length;
    return {
      userId: s.userId,
      fullName: s.user.fullName,
      role: s.user.role,
      records: staffRecords.map((r) => ({
        id: r.id,
        date: r.date,
        checkIn: r.checkInTime,
        checkOut: r.checkOutTime,
        totalHours: r.totalHours,
        status: r.status,
      })),
      totalHours: Math.round(totalHours * 10) / 10,
      presentDays,
    };
  });

  return NextResponse.json(byStaff);
}
