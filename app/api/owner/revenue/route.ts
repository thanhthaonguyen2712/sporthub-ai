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
  const sp = req.nextUrl.searchParams;
  const facilityIdParam = sp.get("facilityId");
  const year  = Number(sp.get("year")  || new Date().getFullYear());
  const month = Number(sp.get("month") || new Date().getMonth() + 1);

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

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1);
  const yearStart  = new Date(year, 0, 1);
  const yearEnd    = new Date(year + 1, 0, 1);

  const [invoicesMonth, invoicesYear, directSalesMonth, directSalesYear, invoiceItemsMonth, invItemsSold, dsItemsSold] = await Promise.all([
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart, lt: monthEnd } },
      select: { finalTotal: true, createdAt: true, booking: { select: { court: { select: { name: true, facility: { select: { name: true } } } } } } },
    }),
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: yearStart, lt: yearEnd } },
      select: { finalTotal: true, createdAt: true },
    }),
    prisma.directSale.findMany({
      where: { facilityId: { in: facilityIds }, createdAt: { gte: monthStart, lt: monthEnd } },
      select: { finalTotal: true, createdAt: true, items: { select: { quantity: true, price: true, service: { select: { name: true } } } } },
    }),
    prisma.directSale.findMany({
      where: { facilityId: { in: facilityIds }, createdAt: { gte: yearStart, lt: yearEnd } },
      select: { finalTotal: true, createdAt: true },
    }),
    prisma.invoiceItem.findMany({
      where: { invoice: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart, lt: monthEnd } }, serviceId: { not: null } },
      select: { quantity: true, price: true, service: { select: { name: true } } },
    }),
    prisma.invoiceItem.groupBy({
      by: ["serviceId"],
      where: { serviceId: { not: null }, invoice: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart, lt: monthEnd } } },
      _sum: { quantity: true },
    }),
    prisma.directSaleItem.groupBy({
      by: ["serviceId"],
      where: { sale: { facilityId: { in: facilityIds }, createdAt: { gte: monthStart, lt: monthEnd } } },
      _sum: { quantity: true },
    }),
  ]);

  const soldByService: Record<number, number> = {};
  invItemsSold.forEach(r => { if (r.serviceId) soldByService[r.serviceId] = (soldByService[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });
  dsItemsSold.forEach(r => { soldByService[r.serviceId] = (soldByService[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });

  const allProducts = await prisma.service.findMany({
    where: { facilityId: { in: facilityIds }, isActive: true, type: "PRODUCT" },
    select: { id: true, name: true, stockQuantity: true, monthlyThreshold: true },
  });

  const slowSelling = allProducts
    .map(p => {
      const soldThisMonth = soldByService[p.id] ?? 0;
      const threshold = p.monthlyThreshold > 0 ? p.monthlyThreshold : Math.max(Math.round(p.stockQuantity * 0.05), 3);
      return { ...p, soldThisMonth, threshold };
    })
    .filter(p => { if (p.monthlyThreshold === 0 && p.stockQuantity < 10) return false; return p.soldThisMonth < p.threshold; })
    .map(p => ({ ...p, soldLast7Days: p.soldThisMonth }));

  // Doanh thu theo ngày (trong tháng đã chọn)
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDay: { date: string; total: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStart = new Date(year, month - 1, d);
    const dayEnd   = new Date(year, month - 1, d + 1);
    const dateStr  = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const inv = invoicesMonth.filter(i => new Date(i.createdAt) >= dayStart && new Date(i.createdAt) < dayEnd).reduce((s, i) => s + Number(i.finalTotal), 0);
    const ds  = directSalesMonth.filter(i => new Date(i.createdAt) >= dayStart && new Date(i.createdAt) < dayEnd).reduce((s, i) => s + Number(i.finalTotal), 0);
    byDay.push({ date: dateStr, total: inv + ds });
  }

  // Doanh thu theo tháng (cả năm)
  const byMonth: { month: string; total: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mStart = new Date(year, m - 1, 1);
    const mEnd   = new Date(year, m, 1);
    const inv = invoicesYear.filter(i => new Date(i.createdAt) >= mStart && new Date(i.createdAt) < mEnd).reduce((s, i) => s + Number(i.finalTotal), 0);
    const ds  = directSalesYear.filter(i => new Date(i.createdAt) >= mStart && new Date(i.createdAt) < mEnd).reduce((s, i) => s + Number(i.finalTotal), 0);
    byMonth.push({ month: `${year}-${String(m).padStart(2, "0")}`, total: inv + ds });
  }

  // Doanh thu theo sân (tháng này)
  const courtMap: Record<string, number> = {};
  invoicesMonth.forEach(i => {
    const name = i.booking.court.name;
    courtMap[name] = (courtMap[name] || 0) + Number(i.finalTotal);
  });
  const byCourt = Object.entries(courtMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  // By service (this month) — kèm giá vốn từ importPrice hiện tại của sản phẩm
  const serviceImportPrices = await prisma.service.findMany({
    where: { facilityId: { in: facilityIds } },
    select: { id: true, name: true, importPrice: true },
  });
  const importPriceMap: Record<number, number> = {};
  serviceImportPrices.forEach(s => { importPriceMap[s.id] = Number(s.importPrice ?? 0); });

  const svcMap: Record<string, { total: number; quantity: number; cogs: number }> = {};
  invoiceItemsMonth.forEach(item => {
    const name = item.service?.name ?? "Không rõ";
    if (!svcMap[name]) svcMap[name] = { total: 0, quantity: 0, cogs: 0 };
    svcMap[name].total    += Number(item.price) * item.quantity;
    svcMap[name].quantity += item.quantity;
    // Dùng importPrice hiện tại làm giá vốn (weighted avg)
    const svcEntry = serviceImportPrices.find(s => s.name === name);
    if (svcEntry) svcMap[name].cogs += importPriceMap[svcEntry.id] * item.quantity;
  });
  directSalesMonth.forEach(sale => {
    sale.items.forEach(item => {
      const name = item.service?.name ?? "Không rõ";
      if (!svcMap[name]) svcMap[name] = { total: 0, quantity: 0, cogs: 0 };
      svcMap[name].total    += Number(item.price) * item.quantity;
      svcMap[name].quantity += item.quantity;
      const svcEntry = serviceImportPrices.find(s => s.name === name);
      if (svcEntry) svcMap[name].cogs += importPriceMap[svcEntry.id] * item.quantity;
    });
  });
  const byService = Object.entries(svcMap)
    .map(([name, v]) => ({ name, total: v.total, quantity: v.quantity, cogs: v.cogs, profit: v.total - v.cogs }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ byDay, byMonth, byCourt, byService, slowSelling });
}
