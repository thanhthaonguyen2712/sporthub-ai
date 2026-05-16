/**
 * prisma/seed-hoamy.ts
 * Seed doanh thu + chấm công đầy đủ cho "Cầu lông Hòa Mỹ" (facility ID 9)
 * Chủ sân: Thanh Thảo – nguyenthanhthao271204@gmail.com
 *
 * Phạm vi bookings  : 01/01/2024 → 15/04/2026
 * Phạm vi chấm công : 01/01/2025 → 15/04/2026 (100% – không vắng)
 *
 * Chạy: npm run seed:hoamy
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// ── IDs cố định ───────────────────────────────────────────────────────────────
const FACILITY_ID = 9;
const STAFF_1_ID  = 8;   // Ngô Duy Tân  – ca sáng
const STAFF_2_ID  = 9;   // Đỗ Tiên      – ca chiều
const COURT_IDS   = [86, 87, 88, 89, 90];

const SVC = {
  cola:   { id: 9,  price: 15_000 },
  sting:  { id: 10, price: 15_000 },
  khan:   { id: 11, price: 10_000 },
  xitN:   { id: 12, price: 130_000 },
  xitL:   { id: 13, price: 140_000 },
  pocari: { id: 14, price: 15_000 },
  revive: { id: 15, price: 15_000 },
  aqua:   { id: 16, price: 15_000 },
  cauV:   { id: 17, price: 40_000 },
  cau3:   { id: 18, price: 45_000 },
};
type SvcItem = { id: number; price: number };

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad  = (n: number) => String(n).padStart(2, "0");
const t    = (hh: number, mm = 0) => new Date(`1970-01-01T${pad(hh)}:${pad(mm)}:00`);
const date = (y: number, m: number, d: number) => new Date(`${y}-${pad(m)}-${pad(d)}`);
const dt   = (y: number, m: number, d: number, hh: number, mm = 0) =>
  new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`);

const dow      = (y: number, m: number, d: number) => new Date(y, m - 1, d).getDay();
const isWeekend= (y: number, m: number, d: number) => [0, 6].includes(dow(y, m, d));

function courtPrice(startH: number, endH: number, weekend: boolean) {
  if (weekend) return (endH - startH) * 150_000;
  let p = 0;
  for (let h = startH; h < endH; h++) p += h >= 17 ? 120_000 : 80_000;
  return p;
}

// Danh sách tên khách walk-in
const NAMES = [
  "Nguyễn Văn An","Trần Thị Bình","Phạm Công Cường","Lê Thị Dung","Hoàng Minh Đức",
  "Vũ Thị Lan","Đặng Văn Hùng","Bùi Thị Mai","Ngô Văn Phúc","Dương Thị Quỳnh",
  "Lý Văn Sơn","Phan Thị Thảo","Trịnh Văn Uy","Mai Thị Vân","Cao Văn Xuân",
  "Đinh Thị Yến","Đỗ Văn Anh","Hà Thị Bảo","Kiều Văn Chiến","Lưu Thị Diễm",
  "Mạc Văn Em","Nghiêm Thị Phượng","Ông Văn Giang","Phùng Thị Hoa","Quách Văn Khôi",
  "Rạng Thị Liên","Sầm Văn Minh","Tạ Thị Ngân","Ứng Văn Oanh","Vương Thị Phụng",
  "Xa Văn Quân","Yên Thị Rồng","Âu Văn Sơn","Ấu Thị Tâm","Hồ Gia Bảo",
  "Đinh Cao Cường","Bùi Minh Dũng","Chu Thị Em","Đào Văn Phát","Giang Thị Gấm",
];
let nameIdx = 0;
const nextName  = () => NAMES[nameIdx++ % NAMES.length];
let phoneNum    = 901_000_100;
const nextPhone = () => `09${phoneNum++}`;

// Sinh lịch slot thuê sân cho 1 ngày
// density levels (ước tính bookings/tháng 30 ngày):
//   0.6 → ~78  |  0.7 → ~93  |  0.8 → ~123  |  0.9 → ~127
//   1.0 → ~157  |  1.1 → ~165  |  1.2 → ~180  |  1.3 → ~188
//   1.4 → ~218  |  1.5 → ~226  |  1.6 → ~241  |  1.7+ → ~251
function daySlots(y: number, m: number, d: number, density = 1.0): Array<[number, number, number]> {
  const wkend = isWeekend(y, m, d);
  const slots: Array<[number, number, number]> = [];
  // Lv1 (0.5+): 2 slot cơ bản mỗi ngày → +60/tháng
  if (density >= 0.5) { slots.push([d % 5, 7, 9]); slots.push([(d + 2) % 5, 17, 19]); }
  // Lv2 (0.6+): cứ 3 ngày thêm 1 → +10/tháng
  if (density >= 0.6 && d % 3 === 0) slots.push([(d + 1) % 5, 9, 11]);
  // Lv3 (0.7+): cứ 2 ngày thêm 1 → +15/tháng
  if (density >= 0.7 && d % 2 === 0) slots.push([(d + 3) % 5, 18, 20]);
  // Lv4 (0.8+): mỗi ngày thêm buổi sáng sớm → +30/tháng (bước nhảy lớn)
  if (density >= 0.8) slots.push([(d + 4) % 5, 6, 8]);
  // Lv5 (1.0+): mỗi ngày thêm buổi chiều → +30/tháng (bước nhảy lớn)
  if (density >= 1.0) slots.push([(d + 1) % 5, 15, 17]);
  // Lv6 (1.2+): cứ 2 ngày thêm trưa → +15/tháng
  if (density >= 1.2 && d % 2 === 0) slots.push([(d + 2) % 5, 11, 13]);
  // Lv7 (1.4+): mỗi ngày thêm buổi tối → +30/tháng (bước nhảy lớn)
  if (density >= 1.4) slots.push([(d + 3) % 5, 19, 21]);
  // Lv8 (1.6+): cứ 2 ngày thêm → +15/tháng
  if (density >= 1.6 && d % 2 === 0) slots.push([d % 5, 13, 15]);
  // Lv9 (1.8+): cứ 3 ngày thêm → +10/tháng
  if (density >= 1.8 && d % 3 === 0) slots.push([(d + 4) % 5, 8, 10]);
  // Cuối tuần bonus
  if (wkend) {
    if (density >= 0.6) slots.push([(d + 4) % 5, 14, 16]);
    if (density >= 0.9 && d % 2 === 0) slots.push([d % 5, 16, 18]);
    if (density >= 1.1) slots.push([(d + 1) % 5, 9, 12]);
    if (density >= 1.3) slots.push([(d + 3) % 5, 13, 15]);
    if (density >= 1.5) slots.push([(d + 2) % 5, 8, 10]);
  }
  return slots;
}

const SVC_LIST = [SVC.cola, SVC.sting, SVC.aqua, SVC.revive, SVC.cauV, SVC.cau3, SVC.khan, SVC.xitN];
function randSvc(d: number): Array<{ svc: SvcItem; qty: number }> | undefined {
  if (d % 3 !== 0) return undefined;
  return [
    { svc: SVC_LIST[d % SVC_LIST.length],           qty: 2 },
    { svc: SVC_LIST[(d + 3) % SVC_LIST.length],     qty: 1 },
  ];
}

const SALE_PATTERNS: Array<Array<{ svc: SvcItem; qty: number }>> = [
  [{ svc: SVC.aqua,   qty: 5 }, { svc: SVC.sting,  qty: 3 }],
  [{ svc: SVC.cauV,   qty: 2 }, { svc: SVC.aqua,   qty: 4 }],
  [{ svc: SVC.khan,   qty: 3 }, { svc: SVC.pocari, qty: 2 }],
  [{ svc: SVC.revive, qty: 6 }],
  [{ svc: SVC.xitN,   qty: 1 }, { svc: SVC.aqua,   qty: 3 }],
  [{ svc: SVC.aqua,   qty: 8 }, { svc: SVC.sting,  qty: 5 }, { svc: SVC.cau3, qty: 1 }],
  [{ svc: SVC.cauV,   qty: 3 }, { svc: SVC.khan,   qty: 2 }],
  [{ svc: SVC.aqua,   qty: 4 }, { svc: SVC.sting,  qty: 2 }],
  [{ svc: SVC.xitL,   qty: 1 }, { svc: SVC.aqua,   qty: 5 }],
  [{ svc: SVC.cau3,   qty: 2 }, { svc: SVC.pocari, qty: 3 }],
  [{ svc: SVC.khan,   qty: 4 }, { svc: SVC.revive, qty: 4 }],
  [{ svc: SVC.cauV,   qty: 4 }, { svc: SVC.sting,  qty: 3 }],
];

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seed Cầu lông Hòa Mỹ (facility 9)...\n");

  // ── Dọn dữ liệu cũ ──────────────────────────────────────────────────────────
  console.log("🧹 Dọn dữ liệu cũ...");

  await prisma.staffSalaryRecord.deleteMany({ where: { facilityId: FACILITY_ID, staffId: { in: [STAFF_1_ID, STAFF_2_ID] } } });
  await prisma.staffAttendance.deleteMany({   where: { staffId: { in: [STAFF_1_ID, STAFF_2_ID] } } });

  const oldSales = await prisma.directSale.findMany({ where: { facilityId: FACILITY_ID }, select: { id: true } });
  if (oldSales.length) {
    await prisma.directSaleItem.deleteMany({ where: { saleId: { in: oldSales.map(s => s.id) } } });
    await prisma.directSale.deleteMany({    where: { id:     { in: oldSales.map(s => s.id) } } });
  }

  const oldBk = await prisma.booking.findMany({ where: { courtId: { in: COURT_IDS } }, select: { id: true } });
  if (oldBk.length) {
    const ids    = oldBk.map(b => b.id);
    const oldInv = await prisma.invoice.findMany({ where: { bookingId: { in: ids } }, select: { id: true } });
    if (oldInv.length) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: oldInv.map(i => i.id) } } });
      await prisma.invoice.deleteMany({    where: { id:         { in: oldInv.map(i => i.id) } } });
    }
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  }
  console.log("✅ Dọn sạch\n");

  // ── Bảng giá ─────────────────────────────────────────────────────────────────
  await prisma.courtPricingRule.deleteMany({ where: { courtId: { in: COURT_IDS } } });
  for (const courtId of COURT_IDS) {
    await prisma.courtPricingRule.createMany({
      data: [
        { courtId, startTime: t(6),  endTime: t(17), pricePerHour: 80_000,  dayType: "WEEKDAY", priority: 1 },
        { courtId, startTime: t(17), endTime: t(22), pricePerHour: 120_000, dayType: "WEEKDAY", priority: 2, isPeak: true },
        { courtId, startTime: t(6),  endTime: t(22), pricePerHour: 150_000, dayType: "WEEKEND", priority: 1 },
      ],
    });
  }

  // Wage config
  for (const staffId of [STAFF_1_ID, STAFF_2_ID]) {
    await prisma.staffWageConfig.upsert({
      where:  { staffId_facilityId: { staffId, facilityId: FACILITY_ID } },
      update: {},
      create: { staffId, facilityId: FACILITY_ID, wageType: "HOURLY", wageRate: 25_000 },
    });
  }

  // ── Sinh bookings + direct sales theo tháng ───────────────────────────────────
  // Phạm vi: 2024 (full) + 2025 (full) + 2026 (T1-T4)
  // Chênh lệch cùng kỳ 2024→2025: 45–99 bookings/tháng
  // Chênh lệch cùng kỳ 2025→2026: 20–50 bookings/tháng
  const MONTHS = [
    // 2024 — năm nền thấp (~78–165 bookings/tháng)
    { y: 2024, m: 1,  lastDay: 31, density: 0.6 },  // ~78
    { y: 2024, m: 2,  lastDay: 29, density: 0.6 },  // ~73 (2024 nhuận)
    { y: 2024, m: 3,  lastDay: 31, density: 0.7 },  // ~93
    { y: 2024, m: 4,  lastDay: 30, density: 0.7 },  // ~93
    { y: 2024, m: 5,  lastDay: 31, density: 0.8 },  // ~123
    { y: 2024, m: 6,  lastDay: 30, density: 1.0 },  // ~157
    { y: 2024, m: 7,  lastDay: 31, density: 1.1 },  // ~165
    { y: 2024, m: 8,  lastDay: 31, density: 1.0 },  // ~157
    { y: 2024, m: 9,  lastDay: 30, density: 0.8 },  // ~123
    { y: 2024, m: 10, lastDay: 31, density: 0.7 },  // ~93
    { y: 2024, m: 11, lastDay: 30, density: 0.6 },  // ~78
    { y: 2024, m: 12, lastDay: 31, density: 0.6 },  // ~78
    // 2025 — năm tăng trưởng (~127–251 bookings/tháng)
    { y: 2025, m: 1,  lastDay: 31, density: 1.0 },  // ~157 (diff vs 2024: +79)
    { y: 2025, m: 2,  lastDay: 28, density: 0.9 },  // ~119 (diff: +46)
    { y: 2025, m: 3,  lastDay: 31, density: 1.1 },  // ~165 (diff: +72)
    { y: 2025, m: 4,  lastDay: 30, density: 1.2 },  // ~180 (diff: +87)
    { y: 2025, m: 5,  lastDay: 31, density: 1.4 },  // ~218 (diff: +95)
    { y: 2025, m: 6,  lastDay: 30, density: 1.6 },  // ~241 (diff: +84)
    { y: 2025, m: 7,  lastDay: 31, density: 1.7 },  // ~251 (diff: +86)
    { y: 2025, m: 8,  lastDay: 31, density: 1.5 },  // ~226 (diff: +69)
    { y: 2025, m: 9,  lastDay: 30, density: 1.2 },  // ~180 (diff: +57)
    { y: 2025, m: 10, lastDay: 31, density: 1.0 },  // ~157 (diff: +64)
    { y: 2025, m: 11, lastDay: 30, density: 0.9 },  // ~127 (diff: +49)
    { y: 2025, m: 12, lastDay: 31, density: 0.8 },  // ~123 (diff: +45)
    // 2026 — năm hiện tại (T1-T4), chênh lệch lớn giữa các tháng để so sánh rõ
    { y: 2026, m: 1,  lastDay: 31, density: 0.8 },  // ~123  — thấp (sau Tết)
    { y: 2026, m: 2,  lastDay: 28, density: 1.5 },  // ~211  — đỉnh (+88)
    { y: 2026, m: 3,  lastDay: 31, density: 1.1 },  // ~165  — hạ (-46)
    { y: 2026, m: 4,  lastDay: 15, density: 1.7 },  // ~127  — tăng trở lại (nửa tháng)
  ];

  let totalBk    = 0;
  let totalSales = 0;

  for (const { y, m, lastDay, density } of MONTHS) {
    console.log(`📅 Tháng ${m}/${y} (1-${lastDay}, density=${density})...`);
    let monthBk = 0;

    for (let d = 1; d <= lastDay; d++) {
      const slots = daySlots(y, m, d, density);
      for (const [courtIdx, startH, endH] of slots) {
        const wkend     = isWeekend(y, m, d);
        const cPrice    = courtPrice(startH, endH, wkend);
        const svcItems  = randSvc(d + m * 3);
        const svcTotal  = (svcItems ?? []).reduce((s, i) => s + i.svc.price * i.qty, 0);
        const final     = cPrice + svcTotal;
        const staffId   = d % 2 === 0 ? STAFF_1_ID : STAFF_2_ID;
        const createdAt = dt(y, m, d, startH - 1 > 0 ? startH - 1 : 8, 0);

        await prisma.$transaction(async (tx) => {
          const booking = await tx.booking.create({
            data: {
              bookingDate:    date(y, m, d),
              startTime:      t(startH),
              endTime:        t(endH),
              totalPrice:     cPrice,
              status:         "COMPLETED",
              paymentStatus:  "PAID",
              isWalkIn:       true,
              walkInName:     nextName(),
              walkInPhone:    nextPhone(),
              createdByStaff: true,
              courtId:        COURT_IDS[courtIdx],
              staffId,
              createdAt,
            },
          });
          await tx.invoice.create({
            data: {
              subTotal:       final,
              discountAmount: 0,
              finalTotal:     final,
              paymentMethod:  (["CASH","TRANSFER","QR"] as const)[d % 3],
              bookingId:      booking.id,
              staffId,
              createdAt,
              items: svcItems
                ? { create: svcItems.map(i => ({ quantity: i.qty, price: i.svc.price, serviceId: i.svc.id })) }
                : undefined,
            },
          });
        });
        monthBk++;
      }
    }
    console.log(`  ✅ ${monthBk} booking + invoice`);
    totalBk += monthBk;

    // Direct sales (mỗi ngày 1 phiếu, bỏ ngày 1 của tháng không phải T4)
    let monthSales = 0;
    for (let d = 1; d <= lastDay; d++) {
      if (d === 1 && m !== 4) continue;
      const pattern  = SALE_PATTERNS[(d + m) % SALE_PATTERNS.length];
      const subTotal = pattern.reduce((s, i) => s + i.svc.price * i.qty, 0);
      const staffId  = d % 2 === 0 ? STAFF_1_ID : STAFF_2_ID;

      await prisma.directSale.create({
        data: {
          facilityId:    FACILITY_ID,
          staffId,
          subTotal,
          finalTotal:    subTotal,
          paymentMethod: (["CASH","TRANSFER","QR"] as const)[d % 3],
          createdAt:     dt(y, m, d, 11, 30),
          items: { create: pattern.map(i => ({ serviceId: i.svc.id, quantity: i.qty, price: i.svc.price })) },
        },
      });
      monthSales++;
    }
    console.log(`  ✅ ${monthSales} phiếu bán hàng`);
    totalSales += monthSales;
  }

  // ── Chấm công 100% (01/01 → 15/04/2026) ──────────────────────────────────────
  console.log("\n⏱️  Chấm công 100% (01/01/2025 → 15/04/2026)...");

  // Lấy toàn bộ nhân viên thực tế của cơ sở (bao gồm cả NV được thêm sau)
  const facilityStaff = await prisma.facilityStaff.findMany({
    where: { facilityId: FACILITY_ID },
    select: { userId: true, user: { select: { fullName: true } } },
  });
  const SHIFTS: Record<number, { inH: number; inM: number; outH: number; outM: number }> = {
    [STAFF_1_ID]: { inH: 6,  inM: 5,  outH: 14, outM: 2  },  // ca sáng
    [STAFF_2_ID]: { inH: 14, inM: 5,  outH: 22, outM: 2  },  // ca chiều
  };

  // Xóa toàn bộ chấm công của nhân viên cơ sở này
  const allStaffIds = facilityStaff.map(fs => fs.userId);
  await prisma.staffAttendance.deleteMany({ where: { staffId: { in: allStaffIds } } });

  const attRows: any[] = [];
  const START = date(2025, 1, 1);
  const END   = date(2026, 4, 15);

  const cur = new Date(START);
  while (cur <= END) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const d = cur.getDate();

    for (const { userId } of facilityStaff) {
      const shift     = SHIFTS[userId] ?? { inH: 8, inM: 0, outH: 17, outM: 0 };
      const { inH, inM, outH, outM } = shift;
      const totalHours = parseFloat(((outH * 60 + outM - inH * 60 - inM) / 60).toFixed(2));

      attRows.push({
        staffId:      userId,
        date:         new Date(cur),
        checkInTime:  dt(y, m, d, inH, inM),
        checkOutTime: dt(y, m, d, outH, outM),
        totalHours,
        status:       "COMPLETED",
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < attRows.length; i += BATCH) {
    await prisma.staffAttendance.createMany({ data: attRows.slice(i, i + BATCH) });
    inserted += Math.min(BATCH, attRows.length - i);
    process.stdout.write(`\r  ...${inserted}/${attRows.length}`);
  }
  console.log(`\n✅ ${attRows.length} bản ghi chấm công (tỉ lệ 100%)`);

  // ── Bảng lương T1–T4 ─────────────────────────────────────────────────────────
  console.log("💰 Tính bảng lương T1–T4/2026...");
  const salaryMonths = [
    { month: 1, year: 2026 },
    { month: 2, year: 2026 },
    { month: 3, year: 2026 },
    { month: 4, year: 2026 },
  ];

  for (const { userId: staffId } of facilityStaff) {
    const wc       = await prisma.staffWageConfig.findFirst({ where: { staffId, facilityId: FACILITY_ID } });
    const wageRate = Number(wc?.wageRate ?? 25_000);

    for (const { month, year } of salaryMonths) {
      const mStart = date(year, month, 1);
      const mEnd   = month < 12 ? date(year, month + 1, 1) : date(year + 1, 1, 1);
      const recs   = await prisma.staffAttendance.findMany({
        where: { staffId, status: "COMPLETED", date: { gte: mStart, lt: mEnd } },
        select: { totalHours: true },
      });
      const totalHours  = recs.reduce((s, r) => s + Number(r.totalHours ?? 0), 0);
      const baseSalary  = Math.round(totalHours * wageRate);
      const bonus       = 300_000;

      await prisma.staffSalaryRecord.upsert({
        where:  { staffId_facilityId_month_year: { staffId, facilityId: FACILITY_ID, month, year } },
        update: { totalHours: parseFloat(totalHours.toFixed(2)), baseSalary, finalSalary: baseSalary + bonus },
        create: {
          staffId, facilityId: FACILITY_ID, month, year,
          totalHours: parseFloat(totalHours.toFixed(2)),
          wageRate, wageType: "HOURLY",
          baseSalary, bonus, finalSalary: baseSalary + bonus,
          isPaid: false,
        },
      });
    }
  }

  // ── Tổng kết ─────────────────────────────────────────────────────────────────
  const revenue = await prisma.invoice.findMany({
    where: { booking: { courtId: { in: COURT_IDS } } },
    select: { finalTotal: true, createdAt: true },
  });
  const byMonth: Record<string, number> = {};
  for (const inv of revenue) {
    const key = `${inv.createdAt.getFullYear()}-${inv.createdAt.getMonth() + 1}`;
    byMonth[key] = (byMonth[key] ?? 0) + Number(inv.finalTotal);
  }
  const salesRev = await prisma.directSale.findMany({
    where: { facilityId: FACILITY_ID },
    select: { finalTotal: true, createdAt: true },
  });
  for (const s of salesRev) {
    const key = `${s.createdAt.getFullYear()}-${s.createdAt.getMonth() + 1}`;
    byMonth[key] = (byMonth[key] ?? 0) + Number(s.finalTotal);
  }

  console.log("\n🎉 Seed Hòa Mỹ hoàn thành!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Tổng booking   : ${totalBk}`);
  console.log(`Tổng bán hàng  : ${totalSales} phiếu`);
  console.log(`Chấm công      : ${attRows.length} bản ghi (100%)`);
  console.log("\nDoanh thu ước tính (thuê sân + bán hàng):");
  let yearTotal = 0;
  for (const [key, val] of Object.entries(byMonth).sort()) {
    const [yr, mo] = key.split("-");
    console.log(`  Tháng ${mo}/${yr}: ${val.toLocaleString("vi-VN")}đ`);
    yearTotal += val;
  }
  console.log(`  Tổng 2026 : ${yearTotal.toLocaleString("vi-VN")}đ`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
