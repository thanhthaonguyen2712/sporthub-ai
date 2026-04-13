/**
 * Seed doanh thu "Cầu lông Hòa Mỹ" (id=9)
 * Chủ sân: Thanh Thảo – nguyenthanhthao271204@gmail.com (userId=7)
 *
 * Phạm vi: 01/01/2026 → 12/04/2026 (ngày hiện tại)
 *   - Tháng 1, 2, 3, 4 (đến 12/4): booking thuê sân + invoice
 *   - Tháng 1, 2, 3, 4: bán hàng trực tiếp
 *   - Tháng 3 + 4: chấm công + bảng lương
 *
 * Chạy: npx ts-node --project tsconfig.seed.json prisma/seed-hoamy.ts
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// ── IDs cố định ───────────────────────────────────────────────────────────────
const FACILITY_ID = 9;
const STAFF_1_ID  = 8;   // Ngô Duy Tân – ca sáng
const STAFF_2_ID  = 9;   // Đỗ Tiên    – ca chiều
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
const t  = (hh: number, mm = 0) =>
  new Date(`1970-01-01T${pad(hh)}:${pad(mm)}:00`);
const pad = (n: number) => String(n).padStart(2, "0");
const date = (y: number, m: number, day: number) =>
  new Date(`${y}-${pad(m)}-${pad(day)}`);
const dt = (y: number, m: number, day: number, hh: number, mm = 0) =>
  new Date(`${y}-${pad(m)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00`);

// 0=CN, 1=T2 ... 6=T7
const dow = (y: number, m: number, day: number) => new Date(y, m - 1, day).getDay();
const isWeekend = (y: number, m: number, day: number) => [0, 6].includes(dow(y, m, day));

function courtPrice(startH: number, endH: number, weekend: boolean) {
  if (weekend) return (endH - startH) * 150_000;
  let p = 0;
  for (let h = startH; h < endH; h++) p += h >= 17 ? 120_000 : 80_000;
  return p;
}

// Dãy tên khách hàng walk-in
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
const nextName = () => NAMES[nameIdx++ % NAMES.length];
let phoneNum = 901_000_100;
const nextPhone = () => `09${phoneNum++}`;

// Sinh lịch bookings cho 1 ngày: trả về mảng [courtIdx, startH, endH]
function daySlots(y: number, m: number, day: number): Array<[number, number, number]> {
  const wkend = isWeekend(y, m, day);
  const slots: Array<[number, number, number]> = [];

  // Ca sáng (6-11h): 1-2 sân
  slots.push([day % 5, 7, 9]);
  if (day % 3 === 0) slots.push([(day + 1) % 5, 9, 11]);

  // Ca vàng (17-22h): 1-3 sân tuỳ ngày
  slots.push([(day + 2) % 5, 17, 19]);
  if (day % 2 === 0) slots.push([(day + 3) % 5, 18, 20]);
  if (wkend) {
    // Cuối tuần thêm ca chiều
    slots.push([(day + 4) % 5, 14, 16]);
    if (day % 2 === 0) slots.push([day % 5, 16, 18]);
  }

  return slots;
}

// Dịch vụ kèm theo ngẫu nhiên (1/3 booking có kèm dịch vụ)
const SVC_LIST = [SVC.cola, SVC.sting, SVC.aqua, SVC.revive, SVC.cauV, SVC.cau3, SVC.khan, SVC.xitN];
function randSvc(day: number): Array<{ svc: SvcItem; qty: number }> | undefined {
  if (day % 3 !== 0) return undefined;
  const s1 = SVC_LIST[day % SVC_LIST.length];
  const s2 = SVC_LIST[(day + 3) % SVC_LIST.length];
  return [{ svc: s1, qty: 2 }, { svc: s2, qty: 1 }];
}

// Mảng dịch vụ cho direct sale theo ngày
const SALE_PATTERNS: Array<Array<{ svc: SvcItem; qty: number }>> = [
  [{ svc: SVC.aqua, qty: 5 }, { svc: SVC.sting, qty: 3 }],
  [{ svc: SVC.cauV, qty: 2 }, { svc: SVC.aqua,  qty: 4 }],
  [{ svc: SVC.khan, qty: 3 }, { svc: SVC.pocari,qty: 2 }],
  [{ svc: SVC.revive,qty:6  }],
  [{ svc: SVC.xitN, qty: 1 }, { svc: SVC.aqua,  qty: 3 }],
  [{ svc: SVC.aqua, qty: 8 }, { svc: SVC.sting, qty: 5 }, { svc: SVC.cau3, qty: 1 }],
  [{ svc: SVC.cauV, qty: 3 }, { svc: SVC.khan,  qty: 2 }],
  [{ svc: SVC.aqua, qty: 4 }, { svc: SVC.sting, qty: 2 }],
  [{ svc: SVC.xitL, qty: 1 }, { svc: SVC.aqua,  qty: 5 }],
  [{ svc: SVC.cau3, qty: 2 }, { svc: SVC.pocari,qty: 3 }],
  [{ svc: SVC.khan, qty: 4 }, { svc: SVC.revive,qty: 4 }],
  [{ svc: SVC.cauV, qty: 4 }, { svc: SVC.sting, qty: 3 }],
];

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🧹 Dọn dữ liệu cũ của cơ sở (booking/invoice/sale/attendance)...");

  // -- Xóa staff/court/service giả còn sót --
  await prisma.staffSalaryRecord.deleteMany({ where: { staffId: { in: [13,14] } } });
  await prisma.staffWageConfig.deleteMany({   where: { staffId: { in: [13,14] } } });
  await prisma.staffAttendance.deleteMany({   where: { staffId: { in: [13,14] } } });
  const fakeSales = await prisma.directSale.findMany({ where: { staffId: { in: [13,14] } }, select: { id: true } });
  if (fakeSales.length) {
    await prisma.directSaleItem.deleteMany({ where: { saleId: { in: fakeSales.map(s=>s.id) } } });
    await prisma.directSale.deleteMany({    where: { id:     { in: fakeSales.map(s=>s.id) } } });
  }
  const fakeBk = await prisma.booking.findMany({ where: { courtId: { in: [93,94,95,96] } }, select: { id: true } });
  if (fakeBk.length) {
    const ids = fakeBk.map(b=>b.id);
    const fakeInv = await prisma.invoice.findMany({ where: { bookingId: { in: ids } }, select: { id: true } });
    if (fakeInv.length) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: fakeInv.map(i=>i.id) } } });
      await prisma.invoice.deleteMany({    where: { id:         { in: fakeInv.map(i=>i.id) } } });
    }
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.courtPricingRule.deleteMany({ where: { courtId: { in: [93,94,95,96] } } });
  await prisma.court.deleteMany({           where: { id:       { in: [93,94,95,96] } } });
  await prisma.service.deleteMany({         where: { id:       { in: [19,20,21,22,23] } } });
  await prisma.facilityStaff.deleteMany({   where: { userId:   { in: [13,14] } } });
  await prisma.user.deleteMany({            where: { id:       { in: [13,14] } } });

  // -- Xóa doanh thu + chấm công cũ của cơ sở 9 (real staff) --
  await prisma.staffSalaryRecord.deleteMany({ where: { facilityId: FACILITY_ID, staffId: { in: [STAFF_1_ID, STAFF_2_ID] } } });
  await prisma.staffAttendance.deleteMany({   where: { staffId: { in: [STAFF_1_ID, STAFF_2_ID] } } });

  // Direct sales của cơ sở 9
  const oldSales = await prisma.directSale.findMany({ where: { facilityId: FACILITY_ID }, select: { id: true } });
  if (oldSales.length) {
    await prisma.directSaleItem.deleteMany({ where: { saleId: { in: oldSales.map(s=>s.id) } } });
    await prisma.directSale.deleteMany({    where: { id:     { in: oldSales.map(s=>s.id) } } });
  }

  // Bookings + invoices trên sân 86-90
  const oldBk = await prisma.booking.findMany({ where: { courtId: { in: COURT_IDS } }, select: { id: true } });
  if (oldBk.length) {
    const ids = oldBk.map(b=>b.id);
    const oldInv = await prisma.invoice.findMany({ where: { bookingId: { in: ids } }, select: { id: true } });
    if (oldInv.length) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: oldInv.map(i=>i.id) } } });
      await prisma.invoice.deleteMany({    where: { id:         { in: oldInv.map(i=>i.id) } } });
    }
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  }

  console.log("✅ Dọn sạch");

  // ── Bảng giá ─────────────────────────────────────────────────────────────
  await prisma.courtPricingRule.deleteMany({ where: { courtId: { in: COURT_IDS } } });
  for (const courtId of COURT_IDS) {
    await prisma.courtPricingRule.createMany({
      data: [
        { courtId, startTime: t(6),  endTime: t(17), pricePerHour: 80_000,  dayType: "WEEKDAY", priority: 1 },
        { courtId, startTime: t(17), endTime: t(22), pricePerHour: 120_000, dayType: "WEEKDAY", priority: 2 },
        { courtId, startTime: t(6),  endTime: t(22), pricePerHour: 150_000, dayType: "WEEKEND", priority: 1 },
      ],
    });
  }

  // Wage config
  await prisma.staffWageConfig.upsert({
    where:  { staffId_facilityId: { staffId: STAFF_1_ID, facilityId: FACILITY_ID } },
    update: {},
    create: { staffId: STAFF_1_ID, facilityId: FACILITY_ID, wageType: "HOURLY", wageRate: 25_000 },
  });
  await prisma.staffWageConfig.upsert({
    where:  { staffId_facilityId: { staffId: STAFF_2_ID, facilityId: FACILITY_ID } },
    update: {},
    create: { staffId: STAFF_2_ID, facilityId: FACILITY_ID, wageType: "HOURLY", wageRate: 25_000 },
  });

  // ── Sinh dữ liệu theo tháng ───────────────────────────────────────────────
  // Phạm vi: T1 (1/1 → 31/1), T2 (1/2 → 28/2), T3 (1/3 → 31/3), T4 (1/4 → 12/4)
  const MONTHS: Array<{ year: number; month: number; lastDay: number }> = [
    { year: 2026, month: 1, lastDay: 31 },
    { year: 2026, month: 2, lastDay: 28 },
    { year: 2026, month: 3, lastDay: 31 },
    { year: 2026, month: 4, lastDay: 12 }, // đến ngày hiện tại
  ];

  let totalBookings = 0;
  let totalSales    = 0;

  for (const { year: y, month: m, lastDay } of MONTHS) {
    console.log(`\n📅 Tháng ${m}/${y} (1-${lastDay})...`);

    // ── Bookings + Invoices ──
    let monthBk = 0;
    for (let day = 1; day <= lastDay; day++) {
      const slots = daySlots(y, m, day);
      for (const [courtIdx, startH, endH] of slots) {
        const wkend  = isWeekend(y, m, day);
        const cPrice = courtPrice(startH, endH, wkend);
        const svcItems = randSvc(day + m * 3); // offset ≠ tháng 3
        const svcTotal = (svcItems ?? []).reduce((s,i) => s + i.svc.price * i.qty, 0);
        const final    = cPrice + svcTotal;
        const staffId  = day % 2 === 0 ? STAFF_1_ID : STAFF_2_ID;

        await prisma.$transaction(async (tx) => {
          const bookingCreatedAt = dt(y, m, day, startH - 1 > 0 ? startH - 1 : 8, 0);

          const booking = await tx.booking.create({
            data: {
              bookingDate:    date(y, m, day),
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
              createdAt:      bookingCreatedAt,
            },
          });

          await tx.invoice.create({
            data: {
              subTotal:       final,
              discountAmount: 0,
              finalTotal:     final,
              paymentMethod:  ["CASH","TRANSFER","QR"][day % 3] as "CASH"|"TRANSFER"|"QR",
              bookingId:      booking.id,
              staffId,
              createdAt:      bookingCreatedAt,
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
    totalBookings += monthBk;

    // ── Direct Sales ──
    let monthSales = 0;
    for (let day = 1; day <= lastDay; day++) {
      // Bỏ qua vài ngày đầu tháng (giả lập ngày nghỉ)
      if (day === 1 && m !== 4) continue;

      const pattern = SALE_PATTERNS[(day + m) % SALE_PATTERNS.length];
      const subTotal = pattern.reduce((s, i) => s + i.svc.price * i.qty, 0);
      const staffId  = day % 2 === 0 ? STAFF_1_ID : STAFF_2_ID;

      await prisma.directSale.create({
        data: {
          facilityId:    FACILITY_ID,
          staffId,
          subTotal,
          finalTotal:    subTotal,
          paymentMethod: ["CASH","TRANSFER","QR"][day % 3] as "CASH"|"TRANSFER"|"QR",
          createdAt:     dt(y, m, day, 11, 30),
          items: { create: pattern.map(i => ({ serviceId: i.svc.id, quantity: i.qty, price: i.svc.price })) },
        },
      });
      monthSales++;
    }

    console.log(`  ✅ ${monthSales} phiếu bán hàng`);
    totalSales += monthSales;
  }

  // ── Chấm công tháng 3 + tháng 4 (đến 12/4) ──────────────────────────────
  console.log("\n⏱️  Chấm công tháng 3 và tháng 4 (đến 12/4)...");

  // Ngày nghỉ của từng nhân viên
  const absentS1: Set<string> = new Set(["2026-3-12","2026-3-25","2026-4-7"]);
  const absentS2: Set<string> = new Set(["2026-3-5","2026-3-19","2026-4-3"]);

  const ATT_MONTHS = [
    { y: 2026, m: 3, lastDay: 31 },
    { y: 2026, m: 4, lastDay: 12 },
  ];

  const attRows: Array<{
    staffId: number; date: Date;
    checkInTime: Date | null; checkOutTime: Date | null;
    totalHours: number | null; status: "COMPLETED"|"ABSENT";
  }> = [];

  for (const { y, m, lastDay } of ATT_MONTHS) {
    for (let day = 1; day <= lastDay; day++) {
      const key = `${y}-${m}-${day}`;
      const dayOfWeek = dow(y, m, day);

      // Staff 1: T2-T7 (không làm CN=0)
      if (dayOfWeek !== 0) {
        const absent = absentS1.has(key);
        attRows.push({
          staffId: STAFF_1_ID,
          date:          date(y, m, day),
          checkInTime:   absent ? null : dt(y, m, day, 6, 5),
          checkOutTime:  absent ? null : dt(y, m, day, 14, 2),
          totalHours:    absent ? null : 7.95,
          status:        absent ? "ABSENT" : "COMPLETED",
        });
      }

      // Staff 2: T2-CN (tất cả ngày)
      {
        const absent = absentS2.has(key);
        attRows.push({
          staffId: STAFF_2_ID,
          date:          date(y, m, day),
          checkInTime:   absent ? null : dt(y, m, day, 14, 5),
          checkOutTime:  absent ? null : dt(y, m, day, 22, 2),
          totalHours:    absent ? null : 7.95,
          status:        absent ? "ABSENT" : "COMPLETED",
        });
      }
    }
  }

  await prisma.staffAttendance.createMany({ data: attRows });
  console.log(`✅ ${attRows.length} bản ghi chấm công`);

  // ── Bảng lương tháng 3 + 4 ────────────────────────────────────────────────
  for (const { y, m } of ATT_MONTHS) {
    for (const staffId of [STAFF_1_ID, STAFF_2_ID]) {
      const hours = attRows
        .filter(r => r.staffId === staffId && r.status === "COMPLETED"
                  && r.date.getFullYear() === y && r.date.getMonth() + 1 === m)
        .reduce((s, r) => s + (r.totalHours ?? 0), 0);

      const wageRate   = 25_000;
      const baseSalary = Math.round(hours * wageRate);
      const bonus      = 300_000;

      await prisma.staffSalaryRecord.upsert({
        where:  { staffId_facilityId_month_year: { staffId, facilityId: FACILITY_ID, month: m, year: y } },
        update: { totalHours: parseFloat(hours.toFixed(2)), baseSalary, finalSalary: baseSalary + bonus },
        create: {
          staffId, facilityId: FACILITY_ID, month: m, year: y,
          totalHours: parseFloat(hours.toFixed(2)),
          wageRate, wageType: "HOURLY",
          baseSalary, bonus,
          finalSalary: baseSalary + bonus,
          isPaid: false,
        },
      });
    }
  }

  console.log("✅ Bảng lương tháng 3 & 4");

  // ── Tổng kết ──────────────────────────────────────────────────────────────
  // Tính doanh thu ước tính
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

  console.log("\n🎉 Seed hoàn thành!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Tổng booking   : ${totalBookings}`);
  console.log(`Tổng bán hàng  : ${totalSales} phiếu`);
  console.log(`Chấm công      : ${attRows.length} bản ghi`);
  console.log("\nDoanh thu ước tính (thuê sân + bán hàng):");
  let yearTotal = 0;
  for (const [key, val] of Object.entries(byMonth).sort()) {
    const [yr, mo] = key.split("-");
    console.log(`  Tháng ${mo}/${yr}: ${val.toLocaleString("vi-VN")}đ`);
    yearTotal += val;
  }
  console.log(`  Cả năm 2026  : ${yearTotal.toLocaleString("vi-VN")}đ`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
