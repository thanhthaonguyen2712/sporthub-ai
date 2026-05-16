import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const facilityIdParam = req.nextUrl.searchParams.get("facilityId");

  let facilityIds: number[];
  if (facilityIdParam) {
    const facility = await prisma.facility.findFirst({ where: { id: Number(facilityIdParam), ownerId } });
    if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    facilityIds = [Number(facilityIdParam)];
  } else {
    const owned = await prisma.facility.findMany({ where: { ownerId }, select: { id: true } });
    facilityIds = owned.map(f => f.id);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const services = await prisma.service.findMany({
    where: { facilityId: { in: facilityIds } },
    orderBy: { id: "asc" },
  });

  // Tính số lượng đã bán trong tháng hiện tại từ InvoiceItem + DirectSaleItem
  const [invSold, dsSold] = await Promise.all([
    prisma.invoiceItem.groupBy({
      by: ["serviceId"],
      where: {
        serviceId: { not: null },
        invoice: {
          booking: { court: { facilityId: { in: facilityIds } } },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.directSaleItem.groupBy({
      by: ["serviceId"],
      where: { sale: { facilityId: { in: facilityIds }, createdAt: { gte: monthStart, lt: monthEnd } } },
      _sum: { quantity: true },
    }),
  ]);

  const soldMap: Record<number, number> = {};
  invSold.forEach(r => { if (r.serviceId) soldMap[r.serviceId] = (soldMap[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });
  dsSold.forEach(r => { soldMap[r.serviceId] = (soldMap[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });

  // Tính tổng số đã bán từ trước đến nay (không lọc theo tháng)
  const [invTotalSold, dsTotalSold] = await Promise.all([
    prisma.invoiceItem.groupBy({
      by: ["serviceId"],
      where: {
        serviceId: { not: null },
        invoice: { booking: { court: { facilityId: { in: facilityIds } } } },
      },
      _sum: { quantity: true },
    }),
    prisma.directSaleItem.groupBy({
      by: ["serviceId"],
      where: { sale: { facilityId: { in: facilityIds } } },
      _sum: { quantity: true },
    }),
  ]);

  const totalSoldMap: Record<number, number> = {};
  invTotalSold.forEach(r => { if (r.serviceId) totalSoldMap[r.serviceId] = (totalSoldMap[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });
  dsTotalSold.forEach(r => { totalSoldMap[r.serviceId] = (totalSoldMap[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });

  // Lấy lịch sử nhập kho (IMPORT) theo từng dịch vụ
  let importLogs: { id: number; serviceId: number; quantity: number; importPrice: number | null; note: string | null; createdAt: Date }[] = [];
  try {
    const raw = await prisma.stockLog.findMany({
      where: { serviceId: { in: services.map(s => s.id) }, type: "IMPORT" },
      orderBy: { createdAt: "asc" },
      select: { id: true, serviceId: true, quantity: true, importPrice: true, note: true, createdAt: true },
    });
    importLogs = raw.map(r => ({ ...r, importPrice: r.importPrice != null ? Number(r.importPrice) : null }));
  } catch {
    // Prisma client chưa được regenerate sau khi thêm field importPrice — bỏ qua lịch sử lô nhập
  }

  const logsByService: Record<number, typeof importLogs> = {};
  importLogs.forEach(log => {
    if (!logsByService[log.serviceId]) logsByService[log.serviceId] = [];
    logsByService[log.serviceId].push(log);
  });

  const result = services.map(s => {
    const totalSold = totalSoldMap[s.id] ?? 0;
    const batches = logsByService[s.id] ?? [];
    const salePrice = Number(s.price);

    // FIFO: phân bổ số đã bán vào từng lô nhập theo thứ tự thời gian
    let remaining = totalSold;
    const importBatches = batches.map(b => {
      const unitCost = Number(b.importPrice ?? s.importPrice ?? 0);
      const soldQty = Math.min(b.quantity, remaining);
      remaining = Math.max(0, remaining - soldQty);
      return {
        id: b.id,
        date: b.createdAt,
        quantity: b.quantity,
        importPrice: unitCost,
        note: b.note,
        soldQty,
        revenue: soldQty * salePrice,
        cogs: soldQty * unitCost,
        profit: soldQty * salePrice - soldQty * unitCost,
      };
    });

    // Tổng doanh thu = tổng bán × giá bán (không đổi theo lô nhập)
    const totalRevenueAll = totalSold * salePrice;
    const totalCogs = importBatches.reduce((sum, b) => sum + b.cogs, 0);
    const totalProfit = totalRevenueAll - totalCogs;

    // Lô nhập gần nhất
    const lastBatch = batches.length > 0 ? batches[batches.length - 1] : null;

    return {
      ...s,
      soldThisMonth: soldMap[s.id] ?? 0,
      totalSold,
      importBatches,
      totalRevenue: totalRevenueAll,
      totalCogs,
      totalProfit,
      lastImport: lastBatch
        ? {
            date: lastBatch.createdAt,
            quantity: lastBatch.quantity,
            importPrice: Number(lastBatch.importPrice ?? s.importPrice ?? 0),
            note: lastBatch.note,
          }
        : null,
    };
  });

  return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/owner/services GET]", err);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, name, type, price, importPrice, stockQuantity, monthlyThreshold, imageUrl } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const service = await prisma.service.create({
    data: {
      facilityId: Number(facilityId),
      name,
      type: type === "RENTAL" ? "RENTAL" : "PRODUCT",
      price: Number(price),
      importPrice: Number(importPrice || 0),
      stockQuantity:    Number(stockQuantity || 0),
      monthlyThreshold: Number(monthlyThreshold || 0),
      ...(imageUrl ? { imageUrl } : {}),
    },
  });

  return NextResponse.json({ success: true, service });
}
