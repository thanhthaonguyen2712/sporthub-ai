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
  const facilityId = Number(req.nextUrl.searchParams.get("facilityId"));

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const services = await prisma.service.findMany({
    where: { facilityId },
    orderBy: { id: "asc" },
  });

  // Tính số lượng đã bán trong tháng hiện tại từ InvoiceItem + DirectSaleItem
  const [invSold, dsSold] = await Promise.all([
    prisma.invoiceItem.groupBy({
      by: ["serviceId"],
      where: {
        serviceId: { not: null },
        invoice: {
          booking: { court: { facilityId } },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.directSaleItem.groupBy({
      by: ["serviceId"],
      where: { sale: { facilityId, createdAt: { gte: monthStart, lt: monthEnd } } },
      _sum: { quantity: true },
    }),
  ]);

  const soldMap: Record<number, number> = {};
  invSold.forEach(r => { if (r.serviceId) soldMap[r.serviceId] = (soldMap[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });
  dsSold.forEach(r => { soldMap[r.serviceId] = (soldMap[r.serviceId] ?? 0) + (r._sum.quantity ?? 0); });

  const result = services.map(s => ({ ...s, soldThisMonth: soldMap[s.id] ?? 0 }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, name, type, price, stockQuantity, monthlyThreshold, imageUrl } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const service = await prisma.service.create({
    data: {
      facilityId: Number(facilityId),
      name,
      type: type === "RENTAL" ? "RENTAL" : "PRODUCT",
      price: Number(price),
      stockQuantity:    Number(stockQuantity || 0),
      monthlyThreshold: Number(monthlyThreshold || 0),
      ...(imageUrl ? { imageUrl } : {}),
    },
  });

  return NextResponse.json({ success: true, service });
}
