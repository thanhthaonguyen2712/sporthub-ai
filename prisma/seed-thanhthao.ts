/**
 * prisma/seed-thanhthao.ts
 * Tạo 2 cơ sở mới cho nguyenthanhthao271204@gmail.com
 *   Cơ sở A: Sport Complex Thanh Thảo 2  (Bóng đá + Cầu lông, 10 sân)
 *   Cơ sở B: Hòa Khánh Sport Court       (Tennis + Pickleball, 10 sân)
 *
 * Dữ liệu: 2024 (12 tháng), 2025 (12 tháng), 2026 (T1-T4)
 * Khách hàng: 70 tài khoản, >50 KH/tháng/cơ sở
 * Biểu đồ: số liệu tăng giảm random để test "Khách hàng & tỷ lệ tăng trưởng"
 *
 * Chạy: npm run seed:thanhthao
 */

import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad    = (n: number) => String(n).padStart(2, "0");
const mkDate = (y: number, m: number, d: number) => new Date(`${y}-${pad(m)}-${pad(d)}`);
const mkDT   = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`);
const mkTime = (h: number, min = 0) => new Date(`1970-01-01T${pad(h)}:${pad(min)}:00`);
const isWknd = (y: number, m: number, d: number) => [0, 6].includes(new Date(y, m - 1, d).getDay());
const PM     = ["CASH", "TRANSFER", "QR"] as const;
const rnd    = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

// ── Mục tiêu số khách hàng độc nhất mỗi tháng (tăng giảm random để test chart) ──
// Mảng 12 phần tử = T1..T12 (chỉ 4 phần tử đầu dùng cho 2026)
const TARGET_CUST: Record<string, number[]> = {
  "fA-2024": [54, 58, 62, 60, 67, 72, 70, 68, 63, 55, 51, 59],
  "fA-2025": [57, 61, 65, 63, 70, 75, 73, 71, 66, 58, 54, 62],
  "fA-2026": [63, 68, 72, 65,  0,  0,  0,  0,  0,  0,  0,  0],
  "fB-2024": [52, 56, 60, 58, 64, 69, 67, 65, 60, 53, 50, 57],
  "fB-2025": [55, 59, 63, 61, 67, 72, 70, 68, 63, 56, 52, 60],
  "fB-2026": [61, 64, 68, 62,  0,  0,  0,  0,  0,  0,  0,  0],
};

// ── Khoảng thời gian cần seed ─────────────────────────────────────────────────
const ALL_PERIODS: Array<{ year: number; month: number; lastDay: number }> = [
  ...Array.from({ length: 12 }, (_, i) => ({
    year: 2024, month: i + 1, lastDay: new Date(2024, i + 1, 0).getDate(),
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    year: 2025, month: i + 1, lastDay: new Date(2025, i + 1, 0).getDate(),
  })),
  { year: 2026, month: 1, lastDay: 31 },
  { year: 2026, month: 2, lastDay: 28 },
  { year: 2026, month: 3, lastDay: 31 },
  { year: 2026, month: 4, lastDay: 15 },
];

// ── Tên khách hàng ────────────────────────────────────────────────────────────
const CUST_NAMES = [
  "Nguyễn Minh An","Trần Thị Bích","Lê Công Cường","Phạm Thị Dung","Hoàng Văn Em",
  "Vũ Thị Phương","Đặng Minh Giàu","Bùi Thị Hoa","Ngô Văn Inh","Dương Thị Kim",
  "Lý Văn Lâm","Phan Thị Mỹ","Trịnh Văn Nam","Mai Thị Oanh","Cao Văn Phú",
  "Đinh Thị Quỳnh","Đỗ Văn Rạng","Hà Thị Sen","Kiều Văn Toàn","Lưu Thị Uyên",
  "Mạc Văn Vinh","Nghiêm Thị Xuân","Ông Văn Yên","Phùng Thị Ánh","Quách Văn Bảo",
  "Rạng Thị Chi","Sầm Văn Đạt","Tạ Thị Giang","Ứng Văn Hải","Vương Thị Khánh",
  "Xa Văn Lộc","Yên Thị Minh","Âu Văn Nhân","Ấu Thị Oanh","Hồ Văn Phát",
  "Đinh Thị Quyên","Bùi Văn Sơn","Chu Thị Tâm","Đào Văn Uy","Giang Thị Vân",
  "Huỳnh Văn Anh","Lê Thị Bảo","Nguyễn Văn Chiến","Trần Thị Diệu","Phạm Văn Đức",
  "Hoàng Thị Em","Vũ Văn Phúc","Đặng Thị Giang","Bùi Văn Hiếu","Ngô Thị Hương",
  "Dương Văn Khiêm","Lý Thị Liên","Phan Văn Minh","Trịnh Thị Ngọc","Mai Văn Oanh",
  "Cao Thị Phương","Đinh Văn Quân","Đỗ Thị Rồng","Hà Văn Sáng","Kiều Thị Thảo",
  "Lưu Văn Uy","Mạc Thị Vân","Nghiêm Văn Xuân","Ông Thị Yến","Phùng Văn Bình",
  "Quách Thị Cẩm","Rạng Văn Dũng","Sầm Thị Em","Tạ Văn Phát","Ứng Thị Gấm",
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seed dữ liệu 2 cơ sở mới cho nguyenthanhthao271204@gmail.com\n");

  // 0. Tìm owner
  const owner = await prisma.user.findUnique({
    where: { email: "nguyenthanhthao271204@gmail.com" },
    select: { id: true },
  });
  if (!owner) {
    console.error("❌ Không tìm thấy nguyenthanhthao271204@gmail.com – chạy seed chính trước.");
    return;
  }
  console.log(`✅ Owner ID: ${owner.id}`);

  // 1. Sport categories
  const [bongDa, cauLong, pickleball, tennis] = await Promise.all([
    prisma.sportCategory.upsert({ where: { slug: "bong-da"    }, update: {}, create: { name: "Bóng đá",    slug: "bong-da",    iconUrl: "https://cdn-icons-png.flaticon.com/128/1165/1165187.png" } }),
    prisma.sportCategory.upsert({ where: { slug: "cau-long"   }, update: {}, create: { name: "Cầu lông",   slug: "cau-long",   iconUrl: "https://cdn-icons-png.flaticon.com/128/2633/2633871.png"  } }),
    prisma.sportCategory.upsert({ where: { slug: "pickleball" }, update: {}, create: { name: "Pickleball", slug: "pickleball", iconUrl: "https://cdn-icons-png.flaticon.com/512/16117/16117721.png" } }),
    prisma.sportCategory.upsert({ where: { slug: "tennis"     }, update: {}, create: { name: "Tennis",     slug: "tennis",     iconUrl: "https://cdn-icons-png.flaticon.com/128/9012/9012192.png"   } }),
  ]);

  // 2. Tạo 70 khách hàng
  console.log("👥 Tạo 70 khách hàng...");
  const pwd = await bcrypt.hash("123456", 10);
  const customers: { id: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const email = `khach${pad(i + 1)}@test.vn`;
    const phone = `0370${String(100001 + i)}`;   // 0370100001 → 0370100070 (10 chữ số)
    const c = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email, phone,
        fullName: CUST_NAMES[i] ?? `Khách hàng ${i + 1}`,
        password: pwd,
        role: "CUSTOMER",
        wallet: { create: { balance: 200_000 } },
      },
      select: { id: true },
    });
    customers.push(c);
  }
  console.log(`✅ ${customers.length} khách hàng (khach01@test.vn → khach70@test.vn / 123456)\n`);

  // 3. Tạo / tìm cơ sở
  console.log("🏟️ Tạo cơ sở...");

  const findOrCreateFacility = async (
    name: string, address: string, description: string,
    sports: { id: number }[],
  ) => {
    let fac = await prisma.facility.findFirst({ where: { ownerId: owner.id, name } });
    if (!fac) {
      fac = await prisma.facility.create({
        data: {
          name, address, description, isActive: true, ownerId: owner.id,
          facilitySports: { create: sports.map(s => ({ sportCategoryId: s.id })) },
        },
      });
      console.log(`  ✅ Tạo: ${name} (ID ${fac.id})`);
    } else {
      console.log(`  ✓  Đã có: ${name} (ID ${fac.id})`);
    }
    return fac;
  };

  const fA = await findOrCreateFacility(
    "Sport Complex Thanh Thảo 2",
    "25 Nguyễn Hữu Thọ, Hải Châu, Đà Nẵng",
    "Cụm sân bóng đá mini và cầu lông trong nhà hiện đại, trang bị đầy đủ ánh sáng & điều hòa",
    [bongDa, cauLong],
  );
  const fB = await findOrCreateFacility(
    "Hòa Khánh Sport Court",
    "88 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng",
    "Sân Tennis và Pickleball chuẩn quốc tế khu vực Hòa Khánh – Liên Chiểu",
    [tennis, pickleball],
  );

  // 4. Tạo sân con
  const mkCourts = async (facilityId: number, sport: { id: number; name: string }, count: number) => {
    const existing = await prisma.court.findMany({
      where: { facilityId, categoryId: sport.id },
      select: { id: true },
    });
    const need = count - existing.length;
    for (let i = existing.length + 1; i <= count; i++) {
      const c = await prisma.court.create({
        data: { name: `${sport.name} ${i}`, facilityId, categoryId: sport.id, isActive: true },
        select: { id: true },
      });
      existing.push(c);
    }
    if (need > 0) console.log(`  ➕ Thêm ${need} sân ${sport.name} vào cơ sở ${facilityId}`);
    return existing;
  };

  console.log("\n🏸 Sân con...");
  const fA_bd = await mkCourts(fA.id, bongDa,    5);   // 5 sân bóng đá
  const fA_cl = await mkCourts(fA.id, cauLong,   5);   // 5 sân cầu lông
  const fB_tn = await mkCourts(fB.id, tennis,    5);   // 5 sân tennis
  const fB_pb = await mkCourts(fB.id, pickleball,5);   // 5 sân pickleball

  const fA_courts = [...fA_bd, ...fA_cl];
  const fB_courts = [...fB_tn, ...fB_pb];
  console.log(`  F_A: ${fA_courts.length} sân (bóng đá + cầu lông)`);
  console.log(`  F_B: ${fB_courts.length} sân (tennis + pickleball)`);

  // 5. Bảng giá
  const addPricing = async (
    courtId: number,
    morning: number, evening: number, weekend: number,
  ) => {
    const cnt = await prisma.courtPricingRule.count({ where: { courtId } });
    if (cnt > 0) return;
    await prisma.courtPricingRule.createMany({
      data: [
        { courtId, startTime: mkTime(6),  endTime: mkTime(17), pricePerHour: morning, dayType: "WEEKDAY", priority: 1 },
        { courtId, startTime: mkTime(17), endTime: mkTime(22), pricePerHour: evening, dayType: "WEEKDAY", priority: 2, isPeak: true },
        { courtId, startTime: mkTime(6),  endTime: mkTime(22), pricePerHour: weekend, dayType: "WEEKEND", priority: 1 },
      ],
    });
  };

  for (const c of fA_bd) await addPricing(c.id, 150_000, 250_000, 300_000);
  for (const c of fA_cl) await addPricing(c.id,  80_000, 120_000, 150_000);
  for (const c of fB_tn) await addPricing(c.id, 200_000, 320_000, 380_000);
  for (const c of fB_pb) await addPricing(c.id, 100_000, 160_000, 200_000);
  console.log("✅ Bảng giá");

  // 6. Dịch vụ bán kèm
  const ensureServices = async (
    facilityId: number,
    items: Array<{ name: string; type: "PRODUCT"|"RENTAL"; price: number; stock: number }>,
  ) => {
    for (const item of items) {
      const exists = await prisma.service.findFirst({ where: { facilityId, name: item.name } });
      if (!exists) {
        await prisma.service.create({
          data: { name: item.name, type: item.type, price: item.price, stockQuantity: item.stock, facilityId },
        });
      }
    }
  };

  await ensureServices(fA.id, [
    { name: "Nước suối 500ml",   type: "PRODUCT", price: 10_000, stock: 300 },
    { name: "Nước tăng lực",     type: "PRODUCT", price: 15_000, stock: 200 },
    { name: "Bánh năng lượng",   type: "PRODUCT", price: 20_000, stock: 100 },
    { name: "Thuê giày đá bóng", type: "RENTAL",  price: 30_000, stock:  20 },
    { name: "Thuê bóng đá",      type: "RENTAL",  price: 20_000, stock:  10 },
    { name: "Thuê vợt cầu lông", type: "RENTAL",  price: 25_000, stock:  15 },
    { name: "Cầu lông (ống 3)",  type: "PRODUCT", price: 45_000, stock: 120 },
  ]);
  await ensureServices(fB.id, [
    { name: "Nước khoáng",           type: "PRODUCT", price: 10_000, stock: 300 },
    { name: "Pocari Sweat",           type: "PRODUCT", price: 18_000, stock: 150 },
    { name: "Revive",                 type: "PRODUCT", price: 15_000, stock: 150 },
    { name: "Thuê vợt tennis",        type: "RENTAL",  price: 50_000, stock:  10 },
    { name: "Thuê vợt pickleball",    type: "RENTAL",  price: 40_000, stock:  12 },
    { name: "Bóng tennis (3 quả)",    type: "PRODUCT", price: 60_000, stock:  80 },
    { name: "Bóng pickleball",        type: "PRODUCT", price: 35_000, stock: 100 },
  ]);
  console.log("✅ Dịch vụ bán kèm");

  const svcARaw = await prisma.service.findMany({ where: { facilityId: fA.id }, select: { id: true, price: true } });
  const svcBRaw = await prisma.service.findMany({ where: { facilityId: fB.id }, select: { id: true, price: true } });
  const svcA = svcARaw.map(s => ({ id: s.id, price: Number(s.price) }));
  const svcB = svcBRaw.map(s => ({ id: s.id, price: Number(s.price) }));

  // 7. Nhân viên
  console.log("\n👷 Tạo nhân viên...");
  type ShiftInfo = { inH: number; inM: number; outH: number; outM: number };

  const mkStaff = async (
    facilityId: number,
    infos: Array<{ email: string; phone: string; name: string; shift: ShiftInfo }>,
  ) => {
    const result: Array<{ id: number; shift: ShiftInfo }> = [];
    for (const info of infos) {
      const user = await prisma.user.upsert({
        where: { email: info.email },
        update: {},
        create: {
          email: info.email, phone: info.phone, fullName: info.name,
          password: pwd, role: "STAFF",
          wallet: { create: { balance: 0 } },
        },
        select: { id: true },
      });
      const hasStaff = await prisma.facilityStaff.findFirst({ where: { facilityId, userId: user.id } });
      if (!hasStaff) {
        await prisma.facilityStaff.create({
          data: { facilityId, userId: user.id, role: "STAFF", createdAt: new Date("2024-01-01") },
        });
      }
      await prisma.staffWageConfig.upsert({
        where:  { staffId_facilityId: { staffId: user.id, facilityId } },
        update: {},
        create: { staffId: user.id, facilityId, wageType: "HOURLY", wageRate: 25_000 },
      });
      result.push({ id: user.id, shift: info.shift });
    }
    return result;
  };

  const STAFF_A = [
    { email: "nv.fa.1@test.vn", phone: "0381000011", name: "Nguyễn Văn Đức",  shift: { inH: 6,  inM: 5,  outH: 14, outM: 2  } },
    { email: "nv.fa.2@test.vn", phone: "0381000012", name: "Trần Thị Hằng",   shift: { inH: 14, inM: 5,  outH: 22, outM: 2  } },
    { email: "nv.fa.3@test.vn", phone: "0381000013", name: "Lê Văn Khoa",     shift: { inH: 8,  inM: 0,  outH: 17, outM: 0  } },
  ];
  const STAFF_B = [
    { email: "nv.fb.1@test.vn", phone: "0381000014", name: "Phạm Thị Lan",    shift: { inH: 6,  inM: 5,  outH: 14, outM: 2  } },
    { email: "nv.fb.2@test.vn", phone: "0381000015", name: "Hoàng Văn Minh",  shift: { inH: 14, inM: 5,  outH: 22, outM: 2  } },
    { email: "nv.fb.3@test.vn", phone: "0381000016", name: "Vũ Thị Nhi",      shift: { inH: 8,  inM: 0,  outH: 17, outM: 0  } },
  ];

  const staffA = await mkStaff(fA.id, STAFF_A);
  const staffB = await mkStaff(fB.id, STAFF_B);
  console.log(`  F_A: ${staffA.length} NV | F_B: ${staffB.length} NV`);

  // 8. Hàm sinh bookings + invoices
  const PRICES_BD = [150_000, 250_000, 300_000, 400_000];
  const PRICES_CL = [ 80_000, 120_000, 150_000, 200_000];
  const PRICES_TN = [200_000, 320_000, 380_000, 500_000];
  const PRICES_PB = [100_000, 160_000, 200_000, 250_000];

  const genBookings = async (
    fKey: "fA" | "fB",
    courts: { id: number }[],
    courtPrices: (idx: number) => number[],
    staff:   Array<{ id: number }>,
    services: { id: number; price: number }[],
    allCust: { id: number }[],
  ) => {
    let totalBk = 0;
    for (const { year, month, lastDay } of ALL_PERIODS) {
      const key     = `${fKey}-${year}`;
      const targets = TARGET_CUST[key];
      if (!targets) continue;
      const custCount = targets[month - 1] ?? 0;
      if (custCount === 0) continue;

      // Pick custCount unique customers for this month (shuffled for variety)
      const shuffled = [...allCust].sort(() => Math.random() - 0.5);
      const monthCust = shuffled.slice(0, Math.min(custCount, allCust.length));

      for (const cust of monthCust) {
        const numBk = rnd(1, 3); // mỗi khách 1-3 lượt đặt trong tháng
        for (let b = 0; b < numBk; b++) {
          const day      = rnd(1, lastDay);
          const hour     = rnd(6, 20);
          const dur      = Math.random() < 0.6 ? 1 : 2;
          const wknd     = isWknd(year, month, day);
          const cIdx     = rnd(0, courts.length - 1);
          const court    = courts[cIdx];
          const prices   = courtPrices(cIdx);
          let   price    = prices[rnd(0, prices.length - 1)] * dur;
          if (wknd) price = Math.round(price * 1.2);

          const staffMbr = staff[rnd(0, staff.length - 1)];
          const createdAt = mkDT(year, month, day, Math.max(6, hour - 1));

          const booking = await prisma.booking.create({
            data: {
              bookingDate:    mkDate(year, month, day),
              startTime:      mkTime(hour),
              endTime:        mkTime(hour + dur),
              totalPrice:     price,
              status:         "COMPLETED",
              paymentStatus:  "PAID",
              courtId:        court.id,
              customerId:     cust.id,
              staffId:        staffMbr.id,
              createdByStaff: false,
              createdAt,
            },
          });

          // 1/3 booking có kèm dịch vụ
          const svc = services.length > 0 && Math.random() < 0.33
            ? services[rnd(0, services.length - 1)] : null;
          const svcTotal = svc ? svc.price * rnd(1, 3) : 0;

          await prisma.invoice.create({
            data: {
              subTotal:       price + svcTotal,
              discountAmount: 0,
              finalTotal:     price + svcTotal,
              paymentMethod:  PM[rnd(0, 2)],
              bookingId:      booking.id,
              staffId:        staffMbr.id,
              createdAt,
              ...(svc ? { items: { create: [{ serviceId: svc.id, quantity: rnd(1, 3), price: svc.price }] } } : {}),
            },
          });

          totalBk++;
        }
      }
      process.stdout.write(`\r  ${year}-T${month.toString().padStart(2,"0")} ${fKey}: ${custCount} KH (~${Math.round(custCount * 2)} BK)   `);
    }
    return totalBk;
  };

  console.log("\n📅 Tạo booking lịch sử 2024 + 2025 + 2026...");

  // Check existing bookings
  const existBkA = await prisma.booking.count({ where: { court: { facilityId: fA.id } } });
  const existBkB = await prisma.booking.count({ where: { court: { facilityId: fB.id } } });

  if (existBkA > 0 || existBkB > 0) {
    console.log(`⚠️  Đã có booking (F_A: ${existBkA}, F_B: ${existBkB}). Dùng --force để tạo lại.`);
    if (!process.argv.includes("--force")) {
      console.log("⏭️  Bỏ qua bước tạo booking. Tiếp tục chấm công & lương...");
      await genAttendanceAndSalary(fA.id, staffA, fB.id, staffB);
      printSummary(fA, fB);
      return;
    }
    // Xóa dữ liệu cũ của 2 cơ sở
    await cleanFacility(fA.id);
    await cleanFacility(fB.id);
  }

  const bkA = await genBookings("fA", fA_courts, (idx) => idx < 5 ? PRICES_BD : PRICES_CL, staffA, svcA, customers);
  console.log(`\n  ✅ F_A: ${bkA} bookings`);

  const bkB = await genBookings("fB", fB_courts, (idx) => idx < 5 ? PRICES_TN : PRICES_PB, staffB, svcB, customers);
  console.log(`\n  ✅ F_B: ${bkB} bookings`);

  // 9. Direct sales
  console.log("\n🛒 Tạo direct sales...");
  const genSales = async (facilityId: number, staff: { id: number }[], services: { id: number; price: number }[]) => {
    if (services.length === 0) return 0;
    let total = 0;
    for (const { year, month, lastDay } of ALL_PERIODS) {
      for (let day = 2; day <= lastDay; day += 2) {
        const s1   = services[rnd(0, services.length - 1)];
        const s2   = services[rnd(0, services.length - 1)];
        const qty1 = rnd(2, 8);
        const qty2 = rnd(1, 5);
        const sub  = s1.price * qty1 + s2.price * qty2;
        const mbr  = staff[day % staff.length];

        await prisma.directSale.create({
          data: {
            facilityId, staffId: mbr.id,
            subTotal: sub, finalTotal: sub,
            paymentMethod: PM[day % 3],
            createdAt: mkDT(year, month, day, 11, 30),
            items: {
              create: [
                { serviceId: s1.id, quantity: qty1, price: s1.price },
                { serviceId: s2.id, quantity: qty2, price: s2.price },
              ],
            },
          },
        });
        total++;
      }
    }
    return total;
  };

  const salA = await genSales(fA.id, staffA, svcA);
  const salB = await genSales(fB.id, staffB, svcB);
  console.log(`  ✅ F_A: ${salA} phiếu | F_B: ${salB} phiếu`);

  // 10 & 11. Chấm công + Lương
  await genAttendanceAndSalary(fA.id, staffA, fB.id, staffB);
  printSummary(fA, fB);
}

// ── Xóa dữ liệu cũ của cơ sở ─────────────────────────────────────────────────
async function cleanFacility(facilityId: number) {
  const courtIds = (await prisma.court.findMany({ where: { facilityId }, select: { id: true } })).map(c => c.id);
  const bkIds    = (await prisma.booking.findMany({ where: { courtId: { in: courtIds } }, select: { id: true } })).map(b => b.id);
  const invIds   = (await prisma.invoice.findMany({ where: { bookingId: { in: bkIds } }, select: { id: true } })).map(i => i.id);
  if (invIds.length) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invIds } } });
  }
  if (bkIds.length) await prisma.booking.deleteMany({ where: { id: { in: bkIds } } });
  const saleIds = (await prisma.directSale.findMany({ where: { facilityId }, select: { id: true } })).map(s => s.id);
  if (saleIds.length) {
    await prisma.directSaleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.directSale.deleteMany({ where: { id: { in: saleIds } } });
  }
  console.log(`  🗑️  Đã xóa dữ liệu cũ cơ sở ${facilityId}`);
}

// ── Chấm công + Bảng lương ────────────────────────────────────────────────────
async function genAttendanceAndSalary(
  facAId: number, staffA: Array<{ id: number; shift: { inH: number; inM: number; outH: number; outM: number } }>,
  facBId: number, staffB: Array<{ id: number; shift: { inH: number; inM: number; outH: number; outM: number } }>,
) {
  console.log("\n⏱️  Chấm công (100%, 2024+2025+2026 T1-T4)...");

  for (const [facilityId, staff] of [[facAId, staffA], [facBId, staffB]] as const) {
    const staffIds = staff.map(s => s.id);
    await prisma.staffAttendance.deleteMany({ where: { staffId: { in: staffIds } } });

    const rows: any[] = [];
    for (const { year, month, lastDay } of ALL_PERIODS) {
      for (let day = 1; day <= lastDay; day++) {
        for (const s of staff) {
          const { inH, inM, outH, outM } = s.shift;
          const totalHours = parseFloat(((outH * 60 + outM - inH * 60 - inM) / 60).toFixed(2));
          rows.push({
            staffId:      s.id,
            date:         mkDate(year, month, day),
            checkInTime:  mkDT(year, month, day, inH, inM),
            checkOutTime: mkDT(year, month, day, outH, outM),
            totalHours,
            status:       "COMPLETED",
          });
        }
      }
    }

    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await prisma.staffAttendance.createMany({ data: rows.slice(i, i + BATCH) });
      process.stdout.write(`\r  Cơ sở ${facilityId}: ${Math.min(i + BATCH, rows.length)}/${rows.length} bản ghi   `);
    }
    console.log(`\n  ✅ Cơ sở ${facilityId}: ${rows.length} bản ghi chấm công`);
  }

  // Bảng lương
  console.log("\n💰 Tính bảng lương...");
  for (const [facilityId, staff] of [[facAId, staffA], [facBId, staffB]] as const) {
    for (const s of staff) {
      const wc = await prisma.staffWageConfig.findFirst({ where: { staffId: s.id, facilityId } });
      const wageRate = Number(wc?.wageRate ?? 25_000);

      for (const { year, month } of ALL_PERIODS) {
        const mStart = mkDate(year, month, 1);
        const mEnd   = month < 12 ? mkDate(year, month + 1, 1) : mkDate(year + 1, 1, 1);
        const recs = await prisma.staffAttendance.findMany({
          where: { staffId: s.id, status: "COMPLETED", date: { gte: mStart, lt: mEnd } },
          select: { totalHours: true },
        });
        const totalHours = recs.reduce((sum, r) => sum + Number(r.totalHours ?? 0), 0);
        const baseSalary = Math.round(totalHours * wageRate);
        const bonus      = 300_000;

        await prisma.staffSalaryRecord.upsert({
          where:  { staffId_facilityId_month_year: { staffId: s.id, facilityId, month, year } },
          update: { totalHours: parseFloat(totalHours.toFixed(2)), baseSalary, finalSalary: baseSalary + bonus },
          create: {
            staffId: s.id, facilityId, month, year,
            totalHours: parseFloat(totalHours.toFixed(2)),
            wageRate, wageType: "HOURLY",
            baseSalary, bonus, finalSalary: baseSalary + bonus,
            isPaid: month < 4 || year < 2026,
          },
        });
      }
    }
  }
  console.log("  ✅ Bảng lương hoàn tất");
}

function printSummary(fA: { id: number; name: string }, fB: { id: number; name: string }) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 Seed hoàn thành!");
  console.log(`📍 Cơ sở A: ${fA.name} (ID ${fA.id})`);
  console.log(`   Môn: Bóng đá (5 sân) + Cầu lông (5 sân) | 3 nhân viên`);
  console.log(`📍 Cơ sở B: ${fB.name} (ID ${fB.id})`);
  console.log(`   Môn: Tennis (5 sân) + Pickleball (5 sân) | 3 nhân viên`);
  console.log(`👥 70 khách hàng: khach01@test.vn → khach70@test.vn / 123456`);
  console.log(`📊 Dữ liệu: 2024 (12 tháng) + 2025 (12 tháng) + 2026 (T1-T4)`);
  console.log(`📈 Khách/tháng/cơ sở: 50-75 (random tăng/giảm để test biểu đồ)`);
  console.log(`   Đăng nhập nguyenthanhthao271204@gmail.com → Dashboard → Tổng quan`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch(e => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
