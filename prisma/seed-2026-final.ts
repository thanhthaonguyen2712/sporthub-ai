/**
 * seed-2026-final.ts
 * Sinh dữ liệu hoàn chỉnh T1-T4/2026 cho owner7 (facilities 9,11,12):
 *   - WorkShifts (Ca sáng/chiều, mỗi ngày làm việc)
 *   - ShiftRegistration
 *   - StaffAttendance (random trễ/quên chấm, vắng, OT)
 *   - StaffSalaryRecord (dựa trên chấm công, tăng lương T3)
 * Chạy: npx ts-node --skip-project prisma/seed-2026-final.ts
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// ── Cấu hình nhân viên ────────────────────────────────────────────────────────
const STAFF_LIST = [
  { fid: 9,  uid: 8,  name: "Ngô Duy Tân",       wageType: "HOURLY", rate: 25_000,  newRate: 35_000,  shift: "morning" },
  { fid: 9,  uid: 9,  name: "Đỗ Tiên",            wageType: "HOURLY", rate: 25_000,  newRate: 28_000,  shift: "afternoon" },
  { fid: 9,  uid: 11, name: "Đặng Minh Khải",     wageType: "DAILY",  rate: 200_000, newRate: 250_000, shift: "morning" },
  { fid: 11, uid: 85, name: "Nguyễn Văn Đức",     wageType: "HOURLY", rate: 25_000,  newRate: 32_000,  shift: "morning" },
  { fid: 11, uid: 86, name: "Trần Thị Hằng",      wageType: "HOURLY", rate: 25_000,  newRate: 25_000,  shift: "afternoon" },
  { fid: 11, uid: 87, name: "Lê Văn Khoa",        wageType: "HOURLY", rate: 28_000,  newRate: 33_000,  shift: "morning" },
  { fid: 12, uid: 88, name: "Phạm Thị Lan",       wageType: "HOURLY", rate: 25_000,  newRate: 32_000,  shift: "morning" },
  { fid: 12, uid: 89, name: "Hoàng Văn Minh",     wageType: "HOURLY", rate: 25_000,  newRate: 25_000,  shift: "afternoon" },
  { fid: 12, uid: 90, name: "Vũ Thị Nhi",        wageType: "HOURLY", rate: 25_000,  newRate: 28_000,  shift: "morning" },
];

// Ca sáng: 6:00-14:00 | Ca chiều: 14:00-22:00
const SHIFTS = {
  morning:   { startH: 6,  startM: 0,  endH: 14, endM: 0,  hours: 8, name: "Ca sáng" },
  afternoon: { startH: 14, startM: 0,  endH: 22, endM: 0,  hours: 8, name: "Ca chiều" },
};

// Tỷ lệ random cho từng nhân viên (tính cách riêng)
const BEHAVIOR: Record<number, { absentRate: number; lateRate: number; forgotOutRate: number; otRate: number }> = {
  8:  { absentRate: 0.02, lateRate: 0.25, forgotOutRate: 0.05, otRate: 0.20 }, // hay đi trễ
  9:  { absentRate: 0.04, lateRate: 0.15, forgotOutRate: 0.10, otRate: 0.15 }, // hay quên chấm ra
  11: { absentRate: 0.01, lateRate: 0.05, forgotOutRate: 0.03, otRate: 0.30 }, // chăm chỉ, OT nhiều
  85: { absentRate: 0.03, lateRate: 0.20, forgotOutRate: 0.08, otRate: 0.18 },
  86: { absentRate: 0.02, lateRate: 0.08, forgotOutRate: 0.06, otRate: 0.10 },
  87: { absentRate: 0.03, lateRate: 0.12, forgotOutRate: 0.05, otRate: 0.25 },
  88: { absentRate: 0.02, lateRate: 0.18, forgotOutRate: 0.07, otRate: 0.12 },
  89: { absentRate: 0.05, lateRate: 0.22, forgotOutRate: 0.12, otRate: 0.08 }, // hay vắng, hay quên
  90: { absentRate: 0.01, lateRate: 0.06, forgotOutRate: 0.04, otRate: 0.22 },
};

function rand() { return Math.random(); }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getWorkDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(2026, 3, 30); // seed đến hết T4
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date > today) break;
    const dow = date.getDay(); // 0=Sun
    if (dow !== 0) days.push(date); // làm T2-T7 (bỏ CN)
  }
  return days;
}

function toTime(date: Date, h: number, m: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0);
}

async function main() {
  const year = 2026;
  const allUids = STAFF_LIST.map(s => s.uid);
  const allFids = [9, 11, 12];

  console.log("🗑️  Xóa dữ liệu 2026 cũ...");
  // Xóa theo thứ tự FK
  await prisma.staffAttendance.deleteMany({
    where: { staffId: { in: allUids }, date: { gte: new Date(2026, 0, 1), lte: new Date(2026, 3, 30) } },
  });
  await prisma.shiftRegistration.deleteMany({
    where: { shift: { facilityId: { in: allFids }, shiftDate: { gte: new Date(2026, 0, 1), lte: new Date(2026, 3, 30) } } },
  });
  await prisma.workShift.deleteMany({
    where: { facilityId: { in: allFids }, shiftDate: { gte: new Date(2026, 0, 1), lte: new Date(2026, 3, 30) } },
  });
  await prisma.staffSalaryRecord.deleteMany({
    where: { facilityId: { in: allFids }, year },
  });
  console.log("✅ Đã xóa xong.");

  // ── Cập nhật wage config (tăng lương áp dụng từ T3) ─────────────────────
  console.log("\n💰 Cập nhật mức lương mới...");
  for (const s of STAFF_LIST) {
    if (s.newRate !== s.rate) {
      await prisma.staffWageConfig.updateMany({
        where: { staffId: s.uid, facilityId: s.fid },
        data: { wageRate: s.newRate },
      });
      console.log(`   ${s.name}: ${s.wageType} ${(s.rate/1000).toFixed(0)}k → ${(s.newRate/1000).toFixed(0)}k (áp dụng T3+)`);
    }
  }

  // ── Sinh ca + chấm công + lương theo từng tháng ──────────────────────────
  for (let month = 0; month < 4; month++) {
    const monthLabel = `T${month + 1}/${year}`;
    console.log(`\n📅 Đang sinh dữ liệu ${monthLabel}...`);

    const workDays = getWorkDays(year, month);
    const isRaisePeriod = month >= 2; // T3, T4 dùng mức lương mới

    // Nhóm nhân viên theo facility
    const byFid: Record<number, typeof STAFF_LIST> = {};
    for (const s of STAFF_LIST) {
      if (!byFid[s.fid]) byFid[s.fid] = [];
      byFid[s.fid].push(s);
    }

    // Tạo WorkShift cho mỗi ngày làm việc
    const shiftMap: Record<string, number> = {}; // "fid_date_type" → shiftId
    for (const fid of allFids) {
      const staffInFacility = byFid[fid] || [];
      for (const day of workDays) {
        for (const shiftType of ["morning", "afternoon"] as const) {
          const cfg = SHIFTS[shiftType];
          const staffForShift = staffInFacility.filter(s => s.shift === shiftType);
          if (staffForShift.length === 0) continue;

          const shift = await prisma.workShift.create({
            data: {
              facilityId: fid,
              name: cfg.name,
              shiftDate: day,
              startTime: toTime(day, cfg.startH, cfg.startM),
              endTime:   toTime(day, cfg.endH, cfg.endM),
              maxStaff: staffForShift.length + 2,
              status: "CLOSED",
            },
          });
          shiftMap[`${fid}_${day.toISOString().slice(0,10)}_${shiftType}`] = shift.id;

          // ShiftRegistration
          await prisma.shiftRegistration.createMany({
            data: staffForShift.map(s => ({
              shiftId: shift.id,
              staffId: s.uid,
              status: "APPROVED",
            })),
          });
        }
      }
    }

    // Tạo StaffAttendance + thống kê cho lương
    type StaffStats = {
      totalHours: number; presentDays: number; lateDays: number;
      forgotCheckOutCount: number; overtimeMinutes: number; overtimePay: number;
      penaltyAmount: number;
    };
    const statsMap: Record<string, StaffStats> = {};

    for (const s of STAFF_LIST) {
      const key = `${s.fid}_${s.uid}`;
      statsMap[key] = { totalHours: 0, presentDays: 0, lateDays: 0, forgotCheckOutCount: 0, overtimeMinutes: 0, overtimePay: 0, penaltyAmount: 0 };
      const beh = BEHAVIOR[s.uid] ?? { absentRate: 0.03, lateRate: 0.15, forgotOutRate: 0.07, otRate: 0.15 };
      const cfg = SHIFTS[s.shift as "morning" | "afternoon"];
      const currentRate = isRaisePeriod ? s.newRate : s.rate;

      const attRecords: any[] = [];

      for (const day of workDays) {
        const dateKey = day.toISOString().slice(0, 10);
        const shiftId = shiftMap[`${s.fid}_${dateKey}_${s.shift}`] ?? null;

        // Vắng mặt?
        if (rand() < beh.absentRate) {
          attRecords.push({
            staffId: s.uid,
            date: day,
            status: "ABSENT",
            checkInTime: null,
            checkOutTime: null,
            totalHours: null,
            isLate: false,
            forgotCheckIn: false,
            forgotCheckOut: false,
            overtimeMinutes: 0,
            shiftId,
          });
          statsMap[key].penaltyAmount += 0; // vắng không phạt (đã trừ ngày công)
          continue;
        }

        statsMap[key].presentDays++;

        const isLate       = rand() < beh.lateRate;
        const forgotOut    = rand() < beh.forgotOutRate;
        const hasOvertime  = rand() < beh.otRate;

        const lateMin      = isLate ? randInt(10, 35) : 0;
        const otMin        = hasOvertime ? randInt(30, 90) : 0;

        const checkIn  = toTime(day, cfg.startH, cfg.startM + lateMin);
        const checkOut = forgotOut ? null : toTime(day, cfg.endH, cfg.endM + otMin);

        const hoursWorked = forgotOut ? cfg.hours - 0.5 : cfg.hours + (otMin / 60);
        statsMap[key].totalHours += hoursWorked;
        if (isLate)    statsMap[key].lateDays++;
        if (forgotOut) statsMap[key].forgotCheckOutCount++;
        if (hasOvertime) statsMap[key].overtimeMinutes += otMin;

        // Lương OT: 1.5× đơn giá
        if (hasOvertime && s.wageType === "HOURLY") {
          statsMap[key].overtimePay += (otMin / 60) * currentRate * 1.5;
        }
        // Phạt đi trễ: -50k/lần
        if (isLate) statsMap[key].penaltyAmount += 50_000;
        // Phạt quên chấm ra: -20k/lần
        if (forgotOut) statsMap[key].penaltyAmount += 20_000;

        attRecords.push({
          staffId: s.uid,
          date: day,
          status: "COMPLETED",
          checkInTime: checkIn,
          checkOutTime: checkOut,
          totalHours: parseFloat(hoursWorked.toFixed(2)),
          isLate,
          forgotCheckIn: false,
          forgotCheckOut: forgotOut,
          overtimeMinutes: otMin,
          shiftId,
        });
      }

      await prisma.staffAttendance.createMany({ data: attRecords });
    }

    // ── Tạo StaffSalaryRecord ────────────────────────────────────────────
    for (const s of STAFF_LIST) {
      const key   = `${s.fid}_${s.uid}`;
      const stats = statsMap[key];
      const currentRate = isRaisePeriod ? s.newRate : s.rate;

      let baseSalary: number;
      if (s.wageType === "HOURLY") {
        baseSalary = stats.totalHours * currentRate;
      } else { // DAILY
        baseSalary = stats.presentDays * currentRate;
      }

      // Thưởng chuyên cần nhỏ nếu không vắng, không trễ
      const bonus = stats.lateDays === 0 && stats.presentDays >= workDays.length - 2
        ? 200_000 : 0;

      const finalSalary = Math.max(0, baseSalary + stats.overtimePay + bonus - stats.penaltyAmount);

      await prisma.staffSalaryRecord.create({
        data: {
          staffId:        s.uid,
          facilityId:     s.fid,
          month:          month + 1,
          year,
          totalHours:     parseFloat(stats.totalHours.toFixed(2)),
          wageRate:       currentRate,
          wageType:       s.wageType,
          baseSalary:     Math.round(baseSalary),
          bonus:          bonus,
          overtimeHours:  parseFloat((stats.overtimeMinutes / 60).toFixed(2)),
          overtimePay:    Math.round(stats.overtimePay),
          penaltyAmount:  stats.penaltyAmount,
          finalSalary:    Math.round(finalSalary),
          isPaid:         month < 3, // T1,T2,T3 đã trả; T4 chưa
          paidAt:         month < 3 ? new Date(year, month + 1, 5) : null,
        },
      });
    }

    // Summary
    const totalSalary = STAFF_LIST.reduce((sum, s) => {
      const stats = statsMap[`${s.fid}_${s.uid}`];
      const currentRate = isRaisePeriod ? s.newRate : s.rate;
      const base = s.wageType === "HOURLY" ? stats.totalHours * currentRate : stats.presentDays * currentRate;
      return sum + Math.max(0, base + stats.overtimePay - stats.penaltyAmount);
    }, 0);

    const lateCount = STAFF_LIST.reduce((sum, s) => sum + statsMap[`${s.fid}_${s.uid}`].lateDays, 0);
    const forgotCount = STAFF_LIST.reduce((sum, s) => sum + statsMap[`${s.fid}_${s.uid}`].forgotCheckOutCount, 0);
    const attCount = workDays.length * STAFF_LIST.length;
    console.log(`   ✅ ${workDays.length} ngày làm, ${attCount} bản ghi chấm công`);
    console.log(`   ⏰ Trễ: ${lateCount} lần | Quên chấm ra: ${forgotCount} lần`);
    console.log(`   💵 Tổng lương: ${(totalSalary/1e6).toFixed(2)}M VND`);
  }

  // ── Kiểm tra kết quả cuối ─────────────────────────────────────────────────
  console.log("\n📊 Kiểm tra lợi nhuận T1-T4/2026:");
  const fids = [9,10,11,12];
  const invoices = await prisma.invoice.findMany({
    where: { booking: { court: { facilityId: { in: fids } } }, createdAt: { gte: new Date(2026,0,1), lt: new Date(2026,4,1) } },
    select: { finalTotal: true, createdAt: true },
  });
  const ds = await prisma.directSale.findMany({
    where: { facilityId: { in: fids }, createdAt: { gte: new Date(2026,0,1), lt: new Date(2026,4,1) } },
    select: { finalTotal: true, createdAt: true },
  });
  const salaries = await prisma.staffSalaryRecord.findMany({
    where: { facilityId: { in: fids }, year: 2026 },
    select: { month: true, finalSalary: true },
  });
  const revByM = new Array(4).fill(0);
  invoices.forEach(i => { const m = new Date(i.createdAt).getMonth(); if(m<4) revByM[m] += Number(i.finalTotal); });
  ds.forEach(d => { const m = new Date(d.createdAt).getMonth(); if(m<4) revByM[m] += Number(d.finalTotal); });
  const salByM = new Array(4).fill(0);
  salaries.forEach(s => { if(s.month<=4) salByM[s.month-1] += Number(s.finalSalary); });

  console.log("Tháng | Doanh thu  | Lương NV   | Lợi nhuận  | OK?");
  for(let m=0;m<4;m++){
    const p = revByM[m]-salByM[m];
    console.log(`T${m+1}    | ${(revByM[m]/1e6).toFixed(1).padStart(7)}M | ${(salByM[m]/1e6).toFixed(1).padStart(7)}M | ${(p/1e6).toFixed(1).padStart(7)}M | ${p>=100e6?'✅':'❌'}`);
  }

  console.log("\n🎉 Hoàn tất sinh dữ liệu T1-T4/2026!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
