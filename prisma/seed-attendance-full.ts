
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const FACILITY_ID = 9;

// Ca làm mặc định theo role
const SHIFTS: Record<number, { inH: number; inM: number; outH: number; outM: number }> = {
  8:  { inH: 6,  inM: 5,  outH: 14, outM: 2  }, // Ngô Duy Tân – ca sáng
  9:  { inH: 14, inM: 5,  outH: 22, outM: 2  }, // Đỗ Tiên    – ca chiều
  11: { inH: 8,  inM: 0,  outH: 17, outM: 0  }, // Đặng Minh Khải – hành chính
};

function pad(n: number) { return String(n).padStart(2, "0"); }

function makeDate(y: number, m: number, d: number) {
  return new Date(`${y}-${pad(m)}-${pad(d)}`);
}

function makeDT(y: number, m: number, d: number, hh: number, mm: number) {
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`);
}

// Sinh mảng tất cả các ngày từ start đến end (inclusive)
function dateRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

async function main() {
  console.log("  Cập nhật chấm công 100% (01/01/2026 → 12/04/2026)...");

  // Lấy danh sách nhân viên thực tế của cơ sở
  const facilityStaff = await prisma.facilityStaff.findMany({
    where: { facilityId: FACILITY_ID },
    select: { userId: true, user: { select: { fullName: true } } },
  });

  const staffIds = facilityStaff.map(fs => fs.userId);
  console.log(`👥 Nhân viên (${staffIds.length}):`, facilityStaff.map(fs => `${fs.user.fullName}(${fs.userId})`).join(", "));

  // Xóa toàn bộ chấm công cũ
  const deleted = await prisma.staffAttendance.deleteMany({
    where: { staffId: { in: staffIds } },
  });
  console.log(` Đã xóa ${deleted.count} bản ghi cũ`);

  // Sinh dữ liệu
  const START = makeDate(2026, 1, 1);
  const END   = makeDate(2026, 4, 12);
  const days  = dateRange(START, END);

  const rows: Array<{
    staffId: number;
    date: Date;
    checkInTime: Date;
    checkOutTime: Date;
    totalHours: number;
    status: "COMPLETED";
  }> = [];

  for (const day of days) {
    const y = day.getFullYear();
    const m = day.getMonth() + 1;
    const d = day.getDate();

    for (const staffId of staffIds) {
      const shift = SHIFTS[staffId] ?? { inH: 8, inM: 0, outH: 17, outM: 0 };
      const totalHours = parseFloat(
        ((shift.outH * 60 + shift.outM - shift.inH * 60 - shift.inM) / 60).toFixed(2)
      );

      rows.push({
        staffId,
        date:         makeDate(y, m, d),
        checkInTime:  makeDT(y, m, d, shift.inH, shift.inM),
        checkOutTime: makeDT(y, m, d, shift.outH, shift.outM),
        totalHours,
        status: "COMPLETED",
      });
    }
  }

  // Insert theo batch 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.staffAttendance.createMany({ data: rows.slice(i, i + BATCH) });
    inserted += Math.min(BATCH, rows.length - i);
    process.stdout.write(`\r  ...${inserted}/${rows.length}`);
  }
  console.log(`\n Tạo ${rows.length} bản ghi chấm công`);

  // Cập nhật / tạo bảng lương cho T1–T4 từ dữ liệu vừa seed
  console.log(" Tính lại bảng lương T1–T4...");

  for (const { userId: staffId } of facilityStaff) {
    const wageConfig = await prisma.staffWageConfig.findUnique({
      where: { staffId_facilityId: { staffId, facilityId: FACILITY_ID } },
    });
    const wageRate = Number(wageConfig?.wageRate ?? 25_000);

    for (const { month, year } of [
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
      { month: 4, year: 2026 },
    ]) {
      const monthStart = makeDate(year, month, 1);
      const monthEnd   = month < 12 ? makeDate(year, month + 1, 1) : makeDate(year + 1, 1, 1);

      const recs = await prisma.staffAttendance.findMany({
        where: {
          staffId,
          status: "COMPLETED",
          date: { gte: monthStart, lt: monthEnd },
        },
        select: { totalHours: true },
      });

      const totalHours  = recs.reduce((s, r) => s + Number(r.totalHours ?? 0), 0);
      const baseSalary  = Math.round(totalHours * wageRate);
      const bonus       = 300_000;
      const finalSalary = baseSalary + bonus;

      await prisma.staffSalaryRecord.upsert({
        where: { staffId_facilityId_month_year: { staffId, facilityId: FACILITY_ID, month, year } },
        update: { totalHours: parseFloat(totalHours.toFixed(2)), baseSalary, finalSalary },
        create: {
          staffId, facilityId: FACILITY_ID, month, year,
          totalHours: parseFloat(totalHours.toFixed(2)),
          wageRate, wageType: "HOURLY",
          baseSalary, bonus, finalSalary,
          isPaid: false,
        },
      });
    }
  }

  console.log(" Bảng lương T1–T4 đã cập nhật");

  // ── Tổng kết ──
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Khoảng thời gian : 01/01/2026 → 12/04/2026 (${days.length} ngày)`);
  console.log(`Số nhân viên     : ${staffIds.length}`);
  console.log(`Tổng bản ghi     : ${rows.length} (${days.length} ngày × ${staffIds.length} NV)`);
  console.log("Tỉ lệ chấm công  : 100%");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
