/**
 * prisma/seed-cashflow.ts
 * Tạo BusinessWallet + BusinessWalletTransaction cho ownerId=2
 * (8 cơ sở: Sân Hòa Xuân, Ngũ Hành Sơn, Liên Chiểu, Thanh Khê, Hải Châu, Hoà Khánh, Sơn Trà, Vũng Thùng)
 * Phạm vi: 01/2025 → 05/2026
 *
 * Chạy: npx ts-node --project tsconfig.seed.json prisma/seed-cashflow.ts
 */

import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const OWNER_ID = 2;

// Cơ sở của ownerId=2
const FACILITIES = [
  { id: 1, name: "Sân thể thao Hòa Xuân",     baseIncome: 18_000_000 },
  { id: 2, name: "SportHub Ngũ Hành Sơn",      baseIncome: 22_000_000 },
  { id: 3, name: "Arena Sport Liên Chiểu",      baseIncome: 15_000_000 },
  { id: 4, name: "Cầu lông Thanh Khê",          baseIncome: 12_000_000 },
  { id: 5, name: "Green Court Hải Châu",         baseIncome: 16_000_000 },
  { id: 6, name: "Hoà Khánh Sport Center",       baseIncome: 14_000_000 },
  { id: 7, name: "Pickleball Sơn Trà",           baseIncome: 9_000_000  },
  { id: 8, name: "Vũng Thùng Basketball Arena",  baseIncome: 11_000_000 },
];

// Mô tả tiền vào
const INCOME_DESCS = [
  "Thu tiền đặt sân buổi sáng",
  "Thu tiền đặt sân buổi chiều",
  "Thu tiền đặt sân buổi tối",
  "Thu tiền walk-in cuối tuần",
  "Thu tiền đặt sân theo giờ",
  "Thu tiền thuê sân theo ngày",
  "Doanh thu dịch vụ kèm (nước uống, vợt)",
  "Thu tiền đặt sân nhóm",
  "Thu tiền đặt sân online",
  "Thu tiền đặt sân qua VNPay",
];

// Mô tả tiền ra
const WITHDRAW_DESCS = [
  "Chi trả lương nhân viên tháng",
  "Thanh toán hóa đơn điện",
  "Thanh toán hóa đơn nước",
  "Mua vật tư bảo trì sân",
  "Chi phí vệ sinh định kỳ",
  "Thanh toán dịch vụ internet",
  "Chi phí sửa chữa thiết bị",
  "Mua sắm dụng cụ thể thao",
  "Chi phí marketing quảng cáo",
  "Chi phí thuê mặt bằng",
];

// Mô tả hoàn tiền
const REFUND_DESCS = [
  "Hoàn tiền hủy đặt sân do mưa",
  "Hoàn tiền hủy sân theo yêu cầu khách",
  "Hoàn tiền đặt sân bị trùng lịch",
  "Hoàn tiền hủy sân khẩn cấp",
  "Hoàn tiền cho khách VIP hủy sân",
];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Tạo ngày ngẫu nhiên trong tháng
function randDate(year: number, month: number): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = rnd(1, daysInMonth);
  const hour = rnd(7, 22);
  const min  = rnd(0, 59);
  return new Date(year, month - 1, day, hour, min, 0);
}

// Mùa: T1-2 thấp, T3-4 trung, T5-8 cao, T9-11 trung, T12 cao
function seasonMult(month: number): number {
  if ([1, 2].includes(month)) return 0.75;
  if ([3, 4].includes(month)) return 0.90;
  if ([5, 6, 7, 8].includes(month)) return 1.15;
  if ([9, 10, 11].includes(month)) return 0.95;
  return 1.10; // T12
}

async function main() {
  console.log("🌱 Seed cashflow cho ownerId=2...\n");

  // Xóa dữ liệu cũ
  const bw = await prisma.businessWallet.findUnique({ where: { userId: OWNER_ID } });
  if (bw) {
    await prisma.businessWalletTransaction.deleteMany({ where: { walletId: bw.id } });
    console.log("🧹 Đã xóa transactions cũ");
  }

  // Tạo/lấy ví
  const wallet = await prisma.businessWallet.upsert({
    where:  { userId: OWNER_ID },
    update: { balance: 0 },
    create: { userId: OWNER_ID, balance: 0, status: "ACTIVE" },
  });
  console.log(`✅ Ví kinh doanh #${wallet.id}`);

  // Phạm vi tháng: T1/2025 → T5/2026
  const PERIODS: { year: number; month: number }[] = [];
  for (let y = 2025; y <= 2026; y++) {
    const maxM = y === 2026 ? 5 : 12;
    for (let m = 1; m <= maxM; m++) {
      PERIODS.push({ year: y, month: m });
    }
  }

  let totalBalance = 0;
  const txData: {
    walletId: number; amount: number; type: string;
    description: string; createdAt: Date; facilityId: number;
  }[] = [];

  for (const fac of FACILITIES) {
    console.log(`  → ${fac.name}`);
    for (const { year, month } of PERIODS) {
      const mult    = seasonMult(month);
      const monthly = Math.round(fac.baseIncome * mult);

      // ── Tiền vào: 8-15 lần mỗi tháng ──
      const incomeCount = rnd(8, 15);
      for (let i = 0; i < incomeCount; i++) {
        const amount = Math.round((monthly / incomeCount) * (0.7 + Math.random() * 0.6) / 10_000) * 10_000;
        txData.push({
          walletId: wallet.id,
          amount,
          type: "DEPOSIT",
          description: `${pick(INCOME_DESCS)} – ${fac.name}`,
          createdAt: randDate(year, month),
          facilityId: fac.id,
        });
        totalBalance += amount;
      }

      // ── Hoàn tiền: 1-3 lần mỗi tháng ──
      const refundCount = rnd(1, 3);
      for (let i = 0; i < refundCount; i++) {
        const amount = rnd(1, 4) * 80_000 + rnd(0, 5) * 20_000;
        txData.push({
          walletId: wallet.id,
          amount,
          type: "REFUND",
          description: `${pick(REFUND_DESCS)} – ${fac.name}`,
          createdAt: randDate(year, month),
          facilityId: fac.id,
        });
        totalBalance -= amount;
      }

      // ── Tiền ra: 1-2 khoản chi mỗi tháng ──
      const withdrawCount = rnd(1, 2);
      for (let i = 0; i < withdrawCount; i++) {
        const amount = rnd(3, 12) * 500_000;
        txData.push({
          walletId: wallet.id,
          amount,
          type: "WITHDRAW",
          description: `${pick(WITHDRAW_DESCS)} – ${fac.name} T${month}/${year}`,
          createdAt: randDate(year, month),
          facilityId: fac.id,
        });
        totalBalance -= amount;
      }
    }
  }

  // Sắp xếp theo thời gian
  txData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Batch insert
  const BATCH = 100;
  for (let i = 0; i < txData.length; i += BATCH) {
    await prisma.businessWalletTransaction.createMany({ data: txData.slice(i, i + BATCH) as any });
  }

  // Cập nhật số dư ví
  const finalBalance = Math.max(0, totalBalance);
  await prisma.businessWallet.update({ where: { id: wallet.id }, data: { balance: finalBalance } });

  console.log(`\n✅ Đã tạo ${txData.length} transactions`);
  console.log(`   Tiền vào : ${txData.filter(t=>t.type==="DEPOSIT").length} giao dịch`);
  console.log(`   Hoàn tiền: ${txData.filter(t=>t.type==="REFUND").length} giao dịch`);
  console.log(`   Tiền ra  : ${txData.filter(t=>t.type==="WITHDRAW").length} giao dịch`);
  console.log(`   Số dư ví : ${finalBalance.toLocaleString("vi-VN")}đ`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
