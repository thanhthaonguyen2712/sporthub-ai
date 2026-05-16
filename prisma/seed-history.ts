/**
 * seed-history.ts
 * Tạo dữ liệu lịch sử năm trước cho owner@sporthub.vn
 * Chạy: npm run seed:history
 */
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// ── Hệ số mùa vụ Da Nẵng (T1-T12) ───────────────────────────────────────────
// Biến động mạnh để test biểu đồ: Q1 thấp, Q2-Q3 tăng vọt, cuối năm giảm mạnh
const MONTHLY_FACTOR = [0.45, 0.55, 0.75, 1.10, 1.35, 1.65, 1.80, 1.50, 1.20, 0.80, 0.50, 0.70];
// Hệ số năm nay (tăng trưởng khoảng 20-30% so với năm trước)
const CUR_YEAR_BONUS = [1.20, 1.15, 1.25, 1.30, 1.28, 1.22, 1.18, 1.25, 1.32, 1.20, 1.15, 1.22];
// Số khách độc nhất mục tiêu mỗi tháng (trend tăng dần trong năm)
const TARGET_UNIQUE_CUSTOMERS = [4, 5, 7, 10, 12, 18, 22, 18, 14, 9, 5, 8];
// Giá mỗi lần đặt (đơn vị đồng) - đa dạng hơn
const PRICES = [80_000, 100_000, 120_000, 150_000, 180_000, 200_000, 240_000, 180_000, 300_000, 250_000];
const PM = ["CASH", "TRANSFER", "QR"] as const;

async function seedYear(year: number, factorOverride?: number[]) {
  const factors = factorOverride || MONTHLY_FACTOR;
  const now = new Date();
  const maxMonth = year === now.getFullYear() ? now.getMonth() : 11; // For current year, stop at current month

  console.log(`\n🌱 Tạo dữ liệu lịch sử năm ${year} (T1-${maxMonth + 1})...`);

  const owner = await prisma.user.findUnique({ where: { email: "owner@sporthub.vn" }, select: { id: true } });
  if (!owner) { console.error("❌ Không tìm thấy owner@sporthub.vn"); return; }

  const existingCount = await prisma.booking.count({
    where: { court: { facility: { ownerId: owner.id } }, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
  });
  if (existingCount > 0) {
    console.log(`⚠️  Đã có ${existingCount} booking năm ${year}.`);
    if (!process.argv.includes("--force")) { console.log("   Dùng --force để ghi đè."); return; }
    const oldBookings = await prisma.booking.findMany({
      where: { court: { facility: { ownerId: owner.id } }, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { id: true },
    });
    const oldIds = oldBookings.map(b => b.id);
    await prisma.invoice.deleteMany({ where: { bookingId: { in: oldIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: oldIds } } });
    console.log(`🗑️  Đã xóa ${oldIds.length} booking cũ`);
  }

  const courts = await prisma.court.findMany({
    where: { facility: { ownerId: owner.id }, isActive: true },
    select: { id: true, name: true, facilityId: true },
  });
  if (courts.length === 0) { console.error("❌ Không có sân"); return; }

  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true } });
  if (customers.length === 0) { console.error("❌ Không có khách hàng"); return; }

  const staffRows = await prisma.facilityStaff.findMany({
    where: { facility: { ownerId: owner.id } },
    select: { facilityId: true, userId: true },
    distinct: ["facilityId"],
  });
  const staffByFacility: Record<number, number | null> = {};
  staffRows.forEach(s => { staffByFacility[s.facilityId] = s.userId; });

  let totalBookings = 0;

  for (let m = 0; m <= maxMonth; m++) {
    const factor      = factors[m];
    const daysInMonth = year === now.getFullYear() && m === now.getMonth()
      ? now.getDate() - 1  // Only up to yesterday for current month
      : new Date(year, m + 1, 0).getDate();
    if (daysInMonth <= 0) continue;

    const bookingsPerCourt = Math.max(3, Math.round(18 * factor));
    const targetCust = Math.min(TARGET_UNIQUE_CUSTOMERS[m], customers.length);
    const custPool   = customers.slice(0, targetCust);

    const bookingsThisMonth: Array<{
      bookingDate: Date; startTime: Date; endTime: Date; price: number;
      courtId: number; customerId: number; staffId: number | null;
    }> = [];

    for (const court of courts) {
      for (let b = 0; b < bookingsPerCourt; b++) {
        const day      = 1 + Math.floor(Math.random() * daysInMonth);
        const hour     = 6 + Math.floor(Math.random() * 15);
        const duration = Math.random() < 0.55 ? 1 : 2;
        const price    = PRICES[Math.floor(Math.random() * PRICES.length)] * duration;
        const cust     = custPool[Math.floor(Math.random() * custPool.length)];
        bookingsThisMonth.push({
          bookingDate: new Date(year, m, day),
          startTime:   new Date(year, m, day, hour, 0, 0),
          endTime:     new Date(year, m, day, hour + duration, 0, 0),
          price,
          courtId:     court.id,
          customerId:  cust.id,
          staffId:     staffByFacility[court.facilityId] ?? null,
        });
      }
    }

    for (const bd of bookingsThisMonth) {
      const booking = await prisma.booking.create({
        data: {
          bookingDate: bd.bookingDate, startTime: bd.startTime, endTime: bd.endTime,
          totalPrice: bd.price, status: "CONFIRMED" as any, paymentStatus: "PAID" as any,
          courtId: bd.courtId, customerId: bd.customerId,
          ...(bd.staffId ? { staffId: bd.staffId, createdByStaff: true } : {}),
          createdAt: bd.bookingDate,
        },
      });
      await prisma.invoice.create({
        data: {
          subTotal: bd.price, discountAmount: 0, finalTotal: bd.price,
          paymentMethod: PM[Math.floor(Math.random() * PM.length)] as any,
          bookingId: booking.id,
          ...(bd.staffId ? { staffId: bd.staffId } : {}),
          createdAt: bd.bookingDate,
        },
      });
      totalBookings++;
    }

    console.log(`  ✓ ${year}-${String(m + 1).padStart(2, "0")}: ${bookingsThisMonth.length} booking (${courts.length} sân × ~${bookingsPerCourt} /sân)`);
  }

  console.log(`\n✅ Năm ${year}: ${totalBookings} bookings`);
}

async function main() {
  const prevYear = new Date().getFullYear() - 1;
  const curYear  = new Date().getFullYear();
  console.log(`\n🌱 Bắt đầu seed dữ liệu lịch sử...`);

  // Seed năm trước với hệ số gốc
  await seedYear(prevYear, MONTHLY_FACTOR);
  // Seed năm nay với hệ số tăng trưởng ~20-30%
  await seedYear(curYear, MONTHLY_FACTOR.map((f, i) => f * CUR_YEAR_BONUS[i]));

  console.log(`\n✅ Hoàn tất! Truy cập Dashboard > Tổng quan để xem biểu đồ.`);
}

main()
  .catch(e => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
