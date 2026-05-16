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
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year  = Number(searchParams.get("year")  || new Date().getFullYear());

  // Xác định danh sách cơ sở cần truy vấn
  let facilityIds: number[];
  if (facilityIdParam) {
    const facility = await prisma.facility.findFirst({ where: { id: Number(facilityIdParam), ownerId } });
    if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    facilityIds = [Number(facilityIdParam)];
  } else {
    const owned = await prisma.facility.findMany({ where: { ownerId }, select: { id: true } });
    facilityIds = owned.map(f => f.id);
  }

  // Áp dụng các thay đổi lương/phân loại đã đến hạn (effectiveFrom <= startDate)
  const pendingChanges = await prisma.staffWageHistory.findMany({
    where: { facilityId: { in: facilityIds }, isApplied: false, effectiveFrom: { lte: new Date(year, month - 1, 1) } },
  });
  if (pendingChanges.length > 0) {
    await prisma.$transaction(async tx => {
      for (const change of pendingChanges) {
        if (change.newRole) {
          await tx.facilityStaff.updateMany({
            where: { userId: change.staffId, facilityId: change.facilityId },
            data: { role: change.newRole as any },
          });
          await tx.user.update({
            where: { id: change.staffId },
            data: { role: change.newRole as any },
          });
        }
        if (change.newWageType && change.newWageRate != null) {
          await tx.staffWageConfig.upsert({
            where: { staffId_facilityId: { staffId: change.staffId, facilityId: change.facilityId } },
            update: { wageType: change.newWageType, wageRate: change.newWageRate },
            create: { staffId: change.staffId, facilityId: change.facilityId, wageType: change.newWageType, wageRate: change.newWageRate },
          });
        }
        await tx.staffWageHistory.update({
          where: { id: change.id },
          data: { isApplied: true, appliedAt: new Date() },
        });
      }
    });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 0);

  const facilityStaff = await prisma.facilityStaff.findMany({
    where: { facilityId: { in: facilityIds } },
    include: {
      user: { select: { id: true, fullName: true, role: true } },
      facility: { select: { name: true } },
    },
  });

  // Loại trùng nhân viên theo userId (giữ lần xuất hiện đầu tiên)
  const seen = new Set<number>();
  const uniqueStaff = facilityStaff.filter(fs => { if (seen.has(fs.userId)) return false; seen.add(fs.userId); return true; });
  const userIds = uniqueStaff.map(s => s.user.id);

  const [wageConfigs, attendanceRecords, salaryRecords] = await Promise.all([
    prisma.staffWageConfig.findMany({ where: { facilityId: { in: facilityIds }, staffId: { in: userIds } } }),
    prisma.staffAttendance.findMany({
      where: { staffId: { in: userIds }, date: { gte: startDate, lte: endDate }, status: { not: "ABSENT" } },
    }),
    prisma.staffSalaryRecord.findMany({ where: { facilityId: { in: facilityIds }, staffId: { in: userIds }, month, year } }),
  ]);

  const staffData = uniqueStaff.map(fs => {
    const cfg = wageConfigs.find(w => w.staffId === fs.user.id);
    const att = attendanceRecords.filter(a => a.staffId === fs.user.id);
    const sal = salaryRecords.find(s => s.staffId === fs.user.id);
    const isDaily = cfg?.wageType === "DAILY";
    const totalHours  = Math.round(att.reduce((sum, r) => sum + Number(r.totalHours || 0), 0) * 100) / 100;
    const presentDays = att.length;
    const lateDays = att.filter(r => r.isLate).length;
    const forgotCheckOutCount = att.filter(r => r.forgotCheckOut).length;
    const overtimeTotalMinutes = att.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
    const overtimeHours = Math.round(overtimeTotalMinutes / 60 * 100) / 100;

    return {
      userId:       fs.user.id,
      fullName:     fs.user.fullName,
      role:         fs.role,
      facilityName: fs.facility.name,
      wageConfig:   cfg ? { wageType: cfg.wageType, wageRate: Number(cfg.wageRate) } : null,
      attendance: {
        totalHours: isDaily ? null : totalHours,
        presentDays,
        lateDays,
        forgotCheckOutCount,
        overtimeHours,
      },
      salaryRecord: sal ? {
        id: sal.id,
        baseSalary: Number(sal.baseSalary),
        bonus: Number(sal.bonus),
        overtimeHours: Number(sal.overtimeHours),
        overtimePay: Number(sal.overtimePay),
        penaltyAmount: Number(sal.penaltyAmount),
        finalSalary: Number(sal.finalSalary),
        wageRate: Number(sal.wageRate),
        wageType: sal.wageType,
        isPaid: sal.isPaid,
        paidAt: sal.paidAt,
      } : null,
    };
  });

  return NextResponse.json({ staffData, payDay: 10 });
}

// POST - Lưu lương 1 nhân viên
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, staffId, month, year, bonus, wageRate, wageType, overtimePay, penaltyAmount } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  await prisma.staffWageConfig.upsert({
    where: { staffId_facilityId: { staffId: Number(staffId), facilityId: Number(facilityId) } },
    update: { wageType, wageRate: Number(wageRate) },
    create: { staffId: Number(staffId), facilityId: Number(facilityId), wageType, wageRate: Number(wageRate) },
  });

  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 0);
  const records   = await prisma.staffAttendance.findMany({
    where: { staffId: Number(staffId), date: { gte: startDate, lte: endDate }, status: { not: "ABSENT" } },
  });

  const totalHours  = records.reduce((sum, r) => sum + Number(r.totalHours || 0), 0);
  const presentDays = records.length;
  const overtimeTotalMin = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
  const overtimeHours = Math.round(overtimeTotalMin / 60 * 100) / 100;

  const base = wageType === "HOURLY"
    ? totalHours * Number(wageRate)
    : presentDays * Number(wageRate);

  const bonusVal    = Number(bonus || 0);
  const overtimeVal = Number(overtimePay || 0);
  const penaltyVal  = Number(penaltyAmount || 0);
  const finalSalary = base + bonusVal + overtimeVal - penaltyVal;

  const record = await prisma.staffSalaryRecord.upsert({
    where: { staffId_facilityId_month_year: { staffId: Number(staffId), facilityId: Number(facilityId), month: Number(month), year: Number(year) } },
    update: {
      totalHours, wageRate: Number(wageRate), wageType,
      baseSalary: base, bonus: bonusVal,
      overtimeHours, overtimePay: overtimeVal,
      penaltyAmount: penaltyVal,
      finalSalary, isPaid: false, paidAt: null,
    },
    create: {
      staffId: Number(staffId), facilityId: Number(facilityId),
      month: Number(month), year: Number(year),
      totalHours, wageRate: Number(wageRate), wageType,
      baseSalary: base, bonus: bonusVal,
      overtimeHours, overtimePay: overtimeVal,
      penaltyAmount: penaltyVal,
      finalSalary,
    },
  });

  return NextResponse.json({ success: true, record });
}
