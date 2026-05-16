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
  const { searchParams } = req.nextUrl;
  const facilityIdParam = searchParams.get("facilityId");
  const staffId = searchParams.get("staffId");
  const invoiceStatus = searchParams.get("status"); // "all" | "ACTIVE" | "CANCELLED"
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  let facilityIds: number[];
  if (facilityIdParam) {
    const facility = await prisma.facility.findFirst({ where: { id: Number(facilityIdParam), ownerId } });
    if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    facilityIds = [Number(facilityIdParam)];
  } else {
    const owned = await prisma.facility.findMany({ where: { ownerId }, select: { id: true } });
    facilityIds = owned.map(f => f.id);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const statusFilter = invoiceStatus && invoiceStatus !== "all"
    ? { status: invoiceStatus as any }
    : {};

  const invoices = await prisma.invoice.findMany({
    where: {
      booking: { court: { facilityId: { in: facilityIds } } },
      createdAt: { gte: startDate, lte: endDate },
      ...(staffId ? { staffId: Number(staffId) } : {}),
      ...statusFilter,
    },
    include: {
      booking: {
        include: {
          court: { select: { name: true, facility: { select: { name: true } } } },
          customer: { select: { fullName: true } },
        },
      },
      staff: { select: { fullName: true } },
      items: { include: { service: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    invoices.map((inv) => ({
      id: inv.id,
      createdAt: inv.createdAt,
      subTotal: inv.subTotal,
      discountAmount: inv.discountAmount,
      finalTotal: inv.finalTotal,
      paymentMethod: inv.paymentMethod,
      invoiceStatus: inv.status,
      bookingStatus: inv.booking.status,
      staffName: inv.staff?.fullName || "—",
      customerName: inv.booking.customer?.fullName || inv.booking.walkInName || "Khách vãng lai",
      courtName: inv.booking.court.name,
      facilityName: inv.booking.court.facility.name,
      items: inv.items.map((it) => ({
        name: it.service?.name || "Tiền sân",
        quantity: it.quantity,
        price: it.price,
      })),
    }))
  );
}
