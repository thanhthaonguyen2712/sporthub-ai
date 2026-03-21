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
  const facilityId = Number(searchParams.get("facilityId"));
  const staffId = searchParams.get("staffId");
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const invoices = await prisma.invoice.findMany({
    where: {
      booking: { court: { facilityId } },
      createdAt: { gte: startDate, lte: endDate },
      ...(staffId ? { staffId: Number(staffId) } : {}),
    },
    include: {
      booking: {
        include: {
          court: { select: { name: true } },
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
      staffName: inv.staff?.fullName || "—",
      customerName: inv.booking.customer?.fullName || "Khách vãng lai",
      courtName: inv.booking.court.name,
      items: inv.items.map((it) => ({
        name: it.service?.name || "Tiền sân",
        quantity: it.quantity,
        price: it.price,
      })),
    }))
  );
}
