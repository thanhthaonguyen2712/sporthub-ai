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
  const facilityId = Number(sp.get("facilityId"));
  const year  = Number(sp.get("year")  || new Date().getFullYear());
  const month = Number(sp.get("month") || new Date().getMonth() + 1); // 1-12

  // Xác nhận facility thuộc owner
  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  // ── Khoảng thời gian ────────────────────────────────────────────
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1);
  const yearStart  = new Date(year, 0, 1);
  const yearEnd    = new Date(year + 1, 0, 1);
  const weekAgo    = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  // ── Doanh thu từ invoice (booking + court) ──────────────────────
  const invoicesMonth = await prisma.invoice.findMany({
    where: {
      booking: { court: { facilityId } },
      createdAt: { gte: monthStart, lt: monthEnd },
    },
    select: {
      finalTotal: true,
      createdAt: true,
      booking: { select: { court: { select: { name: true } } } },
    },
  });

  const invoicesYear = await prisma.invoice.findMany({
    where: {
      booking: { court: { facilityId } },
      createdAt: { gte: yearStart, lt: yearEnd },
    },
    select: { finalTotal: true, createdAt: true },
  });

  // ── DirectSale trong tháng ──────────────────────────────────────
  const directSalesMonth = await prisma.directSale.findMany({
    where: { facilityId, createdAt: { gte: monthStart, lt: monthEnd } },
    select: {
      finalTotal: true,
      createdAt: true,
      items: { select: { quantity: true, price: true, service: { select: { name: true } } } },
    },
  });

  const directSalesYear = await prisma.directSale.findMany({
    where: { facilityId, createdAt: { gte: yearStart, lt: yearEnd } },
    select: { finalTotal: true, createdAt: true },
  });

  // ── Invoice items trong tháng (doanh thu theo dịch vụ) ─────────
  const invoiceItemsMonth = await prisma.invoiceItem.findMany({
    where: {
      invoice: { booking: { court: { facilityId } }, createdAt: { gte: monthStart, lt: monthEnd } },
      serviceId: { not: null },
    },
    select: { quantity: true, price: true, service: { select: { name: true } } },
  });

  // ── Hàng bán chậm (7 ngày qua, PRODUCT, sold <= 20) ─────────────
  const slowSellLogs = await prisma.stockLog.findMany({
    where: {
      service: { facilityId, isActive: true, type: "PRODUCT" },
      type: "SOLD",
      createdAt: { gte: weekAgo },
    },
    select: { quantity: true, serviceId: true },
  });

  const soldByService: Record<number, number> = {};
  slowSellLogs.forEach(l => { soldByService[l.serviceId] = (soldByService[l.serviceId] || 0) + l.quantity; });

  const allProducts = await prisma.service.findMany({
    where: { facilityId, isActive: true, type: "PRODUCT" },
    select: { id: true, name: true, stockQuantity: true },
  });

  const slowSelling = allProducts
    .map(p => ({ ...p, soldLast7Days: soldByService[p.id] || 0 }))
    .filter(p => p.soldLast7Days <= 20);

  // ── Nhóm theo ngày trong tháng ──────────────────────────────────
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDay: { date: string; total: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayStart = new Date(year, month - 1, d);
    const dayEnd   = new Date(year, month - 1, d + 1);
    const inv = invoicesMonth.filter(i => new Date(i.createdAt) >= dayStart && new Date(i.createdAt) < dayEnd)
      .reduce((s, i) => s + Number(i.finalTotal), 0);
    const ds = directSalesMonth.filter(i => new Date(i.createdAt) >= dayStart && new Date(i.createdAt) < dayEnd)
      .reduce((s, i) => s + Number(i.finalTotal), 0);
    byDay.push({ date: dateStr, total: inv + ds });
  }

  // ── Nhóm theo tháng trong năm ───────────────────────────────────
  const byMonth: { month: string; total: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mStart = new Date(year, m - 1, 1);
    const mEnd   = new Date(year, m, 1);
    const inv = invoicesYear.filter(i => new Date(i.createdAt) >= mStart && new Date(i.createdAt) < mEnd)
      .reduce((s, i) => s + Number(i.finalTotal), 0);
    const ds = directSalesYear.filter(i => new Date(i.createdAt) >= mStart && new Date(i.createdAt) < mEnd)
      .reduce((s, i) => s + Number(i.finalTotal), 0);
    byMonth.push({ month: `${year}-${String(m).padStart(2, "0")}`, total: inv + ds });
  }

  // ── Theo sân ────────────────────────────────────────────────────
  const courtMap: Record<string, number> = {};
  invoicesMonth.forEach(i => {
    const name = i.booking.court.name;
    courtMap[name] = (courtMap[name] || 0) + Number(i.finalTotal);
  });
  const byCourt = Object.entries(courtMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  // ── Theo dịch vụ ────────────────────────────────────────────────
  const svcMap: Record<string, { total: number; quantity: number }> = {};
  invoiceItemsMonth.forEach(item => {
    const name = item.service?.name ?? "Không rõ";
    if (!svcMap[name]) svcMap[name] = { total: 0, quantity: 0 };
    svcMap[name].total    += Number(item.price) * item.quantity;
    svcMap[name].quantity += item.quantity;
  });
  directSalesMonth.forEach(sale => {
    sale.items.forEach(item => {
      const name = item.service?.name ?? "Không rõ";
      if (!svcMap[name]) svcMap[name] = { total: 0, quantity: 0 };
      svcMap[name].total    += Number(item.price) * item.quantity;
      svcMap[name].quantity += item.quantity;
    });
  });
  const byService = Object.entries(svcMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ byDay, byMonth, byCourt, byService, slowSelling });
}
