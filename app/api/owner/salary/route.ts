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
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const [salaryRecords, wageConfigs, staffList] = await Promise.all([
    prisma.staffSalaryRecord.findMany({
      where: { facilityId, month, year },
      include: { staff: { select: { fullName: true, email: true } } },
    }),
    prisma.staffWageConfig.findMany({
      where: { facilityId },
      include: { staff: { select: { id: true, fullName: true } } },
    }),
    prisma.facilityStaff.findMany({
      where: { facilityId },
      include: { user: { select: { id: true, fullName: true, role: true } } },
    }),
  ]);

  return NextResponse.json({ salaryRecords, wageConfigs, staffList: staffList.map((s) => s.user) });
}

// POST - Tính và lưu lương tháng cho 1 nhân viên
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, staffId, month, year, bonus, wageRate, wageType } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  // Lưu wage config
  await prisma.staffWageConfig.upsert({
    where: { staffId_facilityId: { staffId: Number(staffId), facilityId: Number(facilityId) } },
    update: { wageType, wageRate: Number(wageRate) },
    create: { staffId: Number(staffId), facilityId: Number(facilityId), wageType, wageRate: Number(wageRate) },
  });

  // Tính tổng giờ/ngày từ chấm công
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const records = await prisma.staffAttendance.findMany({
    where: { staffId: Number(staffId), date: { gte: startDate, lte: endDate }, status: { not: "ABSENT" } },
  });

  const totalHours = records.reduce((sum, r) => sum + Number(r.totalHours || 0), 0);
  const presentDays = records.length;
  const base = wageType === "HOURLY"
    ? totalHours * Number(wageRate)
    : presentDays * Number(wageRate);
  const finalSalary = base + Number(bonus || 0);

  const record = await prisma.staffSalaryRecord.upsert({
    where: { staffId_facilityId_month_year: { staffId: Number(staffId), facilityId: Number(facilityId), month: Number(month), year: Number(year) } },
    update: { totalHours, wageRate: Number(wageRate), wageType, baseSalary: base, bonus: Number(bonus || 0), finalSalary, isPaid: false, paidAt: null },
    create: { staffId: Number(staffId), facilityId: Number(facilityId), month: Number(month), year: Number(year), totalHours, wageRate: Number(wageRate), wageType, baseSalary: base, bonus: Number(bonus || 0), finalSalary },
  });

  return NextResponse.json({ success: true, record });
}
