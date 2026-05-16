/**
 * seed-cogs-2026.ts
 * Sửa dữ liệu cho biểu đồ lợi nhuận thực tế hơn:
 *   1. Sửa importPrice cho tất cả services
 *   2. Sửa giá sai (svc id=9 đang 15,000,000đ → 15,000đ)
 *   3. Xóa DirectSale ảo (không có items), thay bằng DirectSale thực tế có items
 *
 * Mục tiêu mỗi tháng:
 *   Doanh thu ~200-230M | Lương ~50-55M | Giá vốn ~60-70M | Lợi nhuận ~85-115M
 */

import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

// ── Định nghĩa importPrice thực tế cho từng service ──────────────────────────
const IMPORT_PRICES: Record<number, number> = {
  9:  10_000,  // Coca-cola     (bán 15k, nhập 10k)
  10: 9_000,   // Sting đỏ     (bán 15k, nhập 9k)
  11: 3_000,   // Khăn lạnh    (bán 10k, nhập 3k)
  12: 75_000,  // Xịt nóng     (bán 130k, nhập 75k)
  13: 80_000,  // Xịt lạnh     (bán 140k, nhập 80k)
  14: 9_000,   // Pocari       (bán 15k, nhập 9k)
  15: 9_000,   // Revive       (bán 15k, nhập 9k)
  16: 7_000,   // Aquafina     (bán 15k, nhập 7k)
  17: 28_000,  // Cầu Vina     (bán 40k, nhập 28k)
  18: 32_000,  // Cầu ProX     (bán 45k, nhập 32k)
  28: 7_000,   // Nước suối    (bán 15k, nhập 7k)
  29: 10_000,  // Nước tăng lực(bán 17k, nhập 10k)
  30: 12_000,  // Bánh NL      (bán 20k, nhập 12k)
  31: 0,       // Thuê giày    (RENTAL - tính riêng)
  32: 0,       // Thuê bóng    (RENTAL)
  33: 0,       // Thuê vợt CL  (RENTAL)
  34: 30_000,  // Cầu lông ống (bán 45k, nhập 30k)
  35: 6_000,   // Nước khoáng  (bán 10k, nhập 6k)
  36: 11_000,  // Pocari Sweat (bán 18k, nhập 11k)
  37: 9_000,   // Revive 2     (bán 15k, nhập 9k)
  38: 0,       // Thuê vợt tennis (RENTAL)
  39: 0,       // Thuê vợt pkl (RENTAL)
  40: 38_000,  // Bóng tennis  (bán 60k, nhập 38k)
  41: 22_000,  // Bóng pkl     (bán 35k, nhập 22k)
};

// ── Danh sách service bán thường xuyên theo facility ─────────────────────────
const POPULAR_PRODUCTS: Record<number, number[]> = {
  9:  [10, 11, 14, 15, 16, 17, 18, 34], // cầu lông Hòa Mỹ
  10: [28, 29, 35, 36, 37, 40, 41],      // sport center (tennis, pkl)
  11: [10, 11, 14, 16, 29, 30, 17, 18],  // sport complex
  12: [10, 11, 15, 16, 28, 29, 30, 34],  // Hòa Khánh
};

function rand() { return Math.random(); }
function randInt(a: number, b: number) { return Math.floor(rand() * (b - a + 1)) + a; }

async function main() {
  const fids = [9, 10, 11, 12];

  // ── 1. Sửa giá service id=9 (15,000,000 → 15,000) ─────────────────────────
  console.log("🔧 Sửa giá sản phẩm lỗi...");
  await prisma.service.update({ where: { id: 9 }, data: { price: 15_000 } });
  console.log("   ✅ service id=9 price: 15,000,000 → 15,000đ");

  // ── 2. Cập nhật importPrice tất cả services ─────────────────────────────────
  console.log("\n📦 Cập nhật giá nhập...");
  for (const [idStr, ip] of Object.entries(IMPORT_PRICES)) {
    const id = Number(idStr);
    await prisma.service.update({ where: { id }, data: { importPrice: ip } });
  }
  console.log("   ✅ Đã cập nhật importPrice cho", Object.keys(IMPORT_PRICES).length, "services");

  // ── 3. Xóa DirectSale ảo (không có items) ──────────────────────────────────
  console.log("\n🗑️  Xóa DirectSale ảo...");
  const fakeDSList = await prisma.directSale.findMany({
    where: { facilityId: { in: fids }, note: { contains: "Doanh thu tổng hợp" } },
    select: { id: true },
  });
  const fakeIds = fakeDSList.map(d => d.id);
  if (fakeIds.length > 0) {
    await prisma.directSaleItem.deleteMany({ where: { saleId: { in: fakeIds } } });
    await prisma.directSale.deleteMany({ where: { id: { in: fakeIds } } });
    console.log(`   ✅ Đã xóa ${fakeIds.length} DirectSale ảo`);
  }

  // ── 4. Lấy staffId mỗi facility ────────────────────────────────────────────
  const staffRows = await prisma.facilityStaff.findMany({
    where: { facilityId: { in: fids } },
    select: { facilityId: true, userId: true },
    distinct: ["facilityId"],
  });
  const staffMap: Record<number, number> = {};
  staffRows.forEach(s => { staffMap[s.facilityId] = s.userId; });

  // ── 5. Lấy services (sau khi update giá) ───────────────────────────────────
  const services = await prisma.service.findMany({
    where: { facilityId: { in: fids }, type: "PRODUCT" },
    select: { id: true, price: true, importPrice: true, facilityId: true },
  });
  const svcMap: Record<number, typeof services[0]> = {};
  services.forEach(s => { svcMap[s.id] = s; });

  // ── 6. Sinh DirectSale thực tế có items cho T1-T4/2026 ────────────────────
  console.log("\n📊 Sinh doanh thu dịch vụ thực tế...");

  // Mục tiêu: COGS ~65-75M/tháng, revenue dịch vụ ~90-110M/tháng
  // Trải đều ra 20 ngày/tháng, mỗi ngày 1 DirectSale/facility
  const MONTHS = [0, 1, 2, 3]; // T1-T4
  const DAYS_PER_MONTH = [
    [3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22,23],
    [2,3,4,5,6,7,9,10,11,12,13,14,16,17,18,19,20,21,22,23],
    [2,3,4,5,6,7,9,10,11,12,13,14,16,17,18,19,20,21,22,23],
    [1,2,3,4,5,7,8,9,10,11,14,15,16,17,18,21,22,23,24,25],
  ];

  // Mỗi DirectSale bán ~30-60 sản phẩm mix
  // Avg importPrice ~15-20k → COGS mỗi DS = 45 × 17k = 765k
  // 20 ngày × 4 facility = 80 DS/tháng × 765k = 61M COGS/tháng ✓
  // Avg sale price ~25k → revenue DS = 45 × 25k = 1.1M/DS → 80 × 1.1M = 88M/tháng ✓

  let totalDS = 0;

  for (const month of MONTHS) {
    const days = DAYS_PER_MONTH[month];

    for (const fid of [9, 11, 12]) { // fid=10 không có staff được ghi nhận
      const staffId = staffMap[fid];
      if (!staffId) continue;

      const popularSvcIds = POPULAR_PRODUCTS[fid] ?? [10, 16, 17];
      const svcSubset = popularSvcIds.map(id => svcMap[id]).filter(Boolean);
      if (svcSubset.length === 0) continue;

      for (const day of days) {
        const date = new Date(2026, month, day, 15, randInt(0, 59), 0);

        // Tạo danh sách items: 4-8 loại sản phẩm, mỗi loại 3-12 đơn vị
        const items: { serviceId: number; qty: number; unitPrice: number }[] = [];
        const shuffled = [...svcSubset].sort(() => rand() - 0.5).slice(0, randInt(4, 7));

        for (const svc of shuffled) {
          const qty = randInt(3, 12);
          items.push({ serviceId: svc.id, qty, unitPrice: Number(svc.price) });
        }

        const subTotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
        // Thêm 1 khoản dịch vụ lớn (dụng cụ, mặt hàng đặc biệt)
        const bonusItem = svcSubset[randInt(0, svcSubset.length - 1)];
        const bonusQty = randInt(10, 30);
        const bonusTotal = bonusQty * Number(bonusItem.price);
        const finalTotal = subTotal + bonusTotal;

        const ds = await prisma.directSale.create({
          data: {
            facilityId: fid,
            staffId,
            subTotal: finalTotal,
            finalTotal,
            paymentMethod: ["CASH", "TRANSFER", "QR"][randInt(0, 2)] as any,
            note: `Bán hàng dịch vụ ngày ${day}/${month + 1}/2026`,
            createdAt: date,
          },
        });

        await prisma.directSaleItem.createMany({
          data: [
            ...items.map(i => ({ saleId: ds.id, serviceId: i.serviceId, quantity: i.qty, price: i.unitPrice })),
            { saleId: ds.id, serviceId: bonusItem.id, quantity: bonusQty, price: Number(bonusItem.price) },
          ],
        });

        totalDS++;
      }
    }
  }
  console.log(`   ✅ Đã tạo ${totalDS} DirectSale có items`);

  // ── 7. Kiểm tra kết quả ───────────────────────────────────────────────────
  console.log("\n📊 Kết quả T1-T4/2026:");

  // Build importPriceMap
  const allSvcs = await prisma.service.findMany({ where: { facilityId: { in: fids } }, select: { id: true, importPrice: true } });
  const ipMap: Record<number, number> = {};
  allSvcs.forEach(s => { ipMap[s.id] = Number(s.importPrice); });

  const invoices = await prisma.invoice.findMany({
    where: { booking: { court: { facilityId: { in: fids } } }, createdAt: { gte: new Date(2026,0,1), lt: new Date(2026,4,1) } },
    select: { finalTotal: true, createdAt: true },
  });
  const ds2026 = await prisma.directSale.findMany({
    where: { facilityId: { in: fids }, createdAt: { gte: new Date(2026,0,1), lt: new Date(2026,4,1) } },
    select: { finalTotal: true, createdAt: true },
  });
  const salaries = await prisma.staffSalaryRecord.findMany({
    where: { facilityId: { in: fids }, year: 2026 },
    select: { month: true, finalSalary: true },
  });

  // COGS
  const [invItems, dsItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: { serviceId:{not:null}, invoice:{ createdAt:{gte:new Date(2026,0,1),lt:new Date(2026,4,1)}, booking:{court:{facilityId:{in:fids}}} } },
      select: { serviceId:true, quantity:true, invoice:{select:{createdAt:true}} },
    }),
    prisma.directSaleItem.findMany({
      where: { sale:{ facilityId:{in:fids}, createdAt:{gte:new Date(2026,0,1),lt:new Date(2026,4,1)} } },
      select: { serviceId:true, quantity:true, sale:{select:{createdAt:true}} },
    }),
  ]);

  const revByM = new Array(4).fill(0);
  const cogsMap = new Array(4).fill(0);
  const salByM = new Array(4).fill(0);

  invoices.forEach(i => { const m = new Date(i.createdAt).getMonth(); if(m<4) revByM[m] += Number(i.finalTotal); });
  ds2026.forEach(d => { const m = new Date(d.createdAt).getMonth(); if(m<4) revByM[m] += Number(d.finalTotal); });
  invItems.forEach(i => { if(!i.serviceId) return; const m = new Date(i.invoice.createdAt).getMonth(); if(m<4) cogsMap[m] += (ipMap[i.serviceId]??0)*i.quantity; });
  dsItems.forEach(i => { const m = new Date(i.sale.createdAt).getMonth(); if(m<4) cogsMap[m] += (ipMap[i.serviceId]??0)*i.quantity; });
  salaries.forEach(s => { if(s.month<=4) salByM[s.month-1] += Number(s.finalSalary); });

  const labels = ["T1","T2","T3","T4"];
  console.log("Tháng | Doanh thu  | Lương      | Giá vốn    | Lợi nhuận");
  for(let m=0;m<4;m++){
    const p = revByM[m]-salByM[m]-cogsMap[m];
    const rev=revByM[m]/1e6, sal=salByM[m]/1e6, cogs=cogsMap[m]/1e6, profit=p/1e6;
    const ok = p>=100e6?'✅':p>=80e6?'🟡':'❌';
    console.log(`${labels[m]}    | ${rev.toFixed(1).padStart(7)}M | ${sal.toFixed(1).padStart(7)}M | ${cogs.toFixed(1).padStart(7)}M | ${profit.toFixed(1).padStart(7)}M ${ok}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
