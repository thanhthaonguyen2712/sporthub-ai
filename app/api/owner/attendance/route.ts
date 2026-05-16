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
  const facilityIdParam = searchParams.get("facilityId");
  const viewMode = searchParams.get("viewMode") || "month";
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());
  const dateStr = searchParams.get("date");

  // Xác định danh sách facility ID (theo cơ sở cụ thể hoặc tất cả của chủ)
  let facilityIds: number[];
  if (facilityIdParam) {
    const facility = await prisma.facility.findFirst({ where: { id: Number(facilityIdParam), ownerId } });
    if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    facilityIds = [Number(facilityIdParam)];
  } else {
    const ownedFacilities = await prisma.facility.findMany({ where: { ownerId }, select: { id: true } });
    facilityIds = ownedFacilities.map((f) => f.id);
  }

  const staffList = await prisma.facilityStaff.findMany({
    where: { facilityId: { in: facilityIds } },
    select: {
      userId: true,
      facilityId: true,
      role: true,
      facility: { select: { name: true } },
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  // Loại trùng nhân viên (cùng người có thể làm ở nhiều cơ sở)
  const staffMap = new Map<number, (typeof staffList)[0]>();
  staffList.forEach(s => { if (!staffMap.has(s.userId)) staffMap.set(s.userId, s); });
  const uniqueStaff = Array.from(staffMap.values());
  const staffIds = uniqueStaff.map((s) => s.userId);

  let startDate: Date, endDate: Date;
  if (viewMode === "day" && dateStr) {
    const d = new Date(dateStr);
    startDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    endDate = new Date(startDate.getTime() + 86400000);
  } else {
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0);
  }

  const [records, wageConfigs] = await Promise.all([
    prisma.staffAttendance.findMany({
      where: {
        staffId: { in: staffIds },
        date: viewMode === "day" && dateStr
          ? { gte: startDate, lt: endDate }
          : { gte: startDate, lte: endDate },
      },
      include: {
        staff: { select: { fullName: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: [{ staffId: "asc" }, { date: "asc" }],
    }),
    prisma.staffWageConfig.findMany({
      where: { facilityId: { in: facilityIds }, staffId: { in: staffIds } },
    }),
  ]);

  const byStaff = uniqueStaff.map((s) => {
    const wageConfig = wageConfigs.find(w => w.staffId === s.userId);
    const staffRecords = records.filter((r) => r.staffId === s.userId);
    const totalHours = staffRecords.reduce((sum, r) => sum + Number(r.totalHours || 0), 0);
    const presentDays = staffRecords.filter((r) => r.status !== "ABSENT").length;
    const lateDays = staffRecords.filter((r) => r.isLate).length;
    const forgotCheckInCount = staffRecords.filter(r => r.forgotCheckIn).length;
    const forgotCheckOutCount = staffRecords.filter(r => r.forgotCheckOut).length;
    const overtimeTotal = staffRecords.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
    const isDaily = wageConfig?.wageType === "DAILY";

    return {
      userId: s.userId,
      fullName: s.user.fullName,
      role: s.user.role,
      facilityRole: s.role,
      facilityName: s.facility.name,
      wageType: wageConfig?.wageType || null,
      records: staffRecords.map((r) => ({
        id: r.id,
        date: r.date,
        checkIn: r.checkInTime,
        checkOut: r.checkOutTime,
        totalHours: isDaily ? null : r.totalHours,
        status: r.status,
        isLate: r.isLate,
        forgotCheckIn: r.forgotCheckIn,
        forgotCheckOut: r.forgotCheckOut,
        overtimeMinutes: r.overtimeMinutes,
        shift: r.shift ? { id: r.shift.id, name: r.shift.name, startTime: r.shift.startTime, endTime: r.shift.endTime } : null,
      })),
      totalHours: isDaily ? null : Math.round(totalHours * 10) / 10,
      presentDays,
      lateDays,
      forgotCheckInCount,
      forgotCheckOutCount,
      overtimeTotalMinutes: overtimeTotal,
    };
  });

  return NextResponse.json(byStaff);
}
