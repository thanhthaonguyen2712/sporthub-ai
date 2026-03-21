import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/staff/pos/[invoiceId] - Thêm dịch vụ vào hóa đơn đang mở
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const facilityStaff = await prisma.facilityStaff.findFirst({ where: { userId } });
  if (!facilityStaff) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 403 });

  const { invoiceId } = await params;
  const { services } = await req.json(); // [{ serviceId, quantity, price }]

  if (!services || services.length === 0) {
    return NextResponse.json({ error: "Không có dịch vụ nào" }, { status: 400 });
  }

  // Kiểm tra hóa đơn thuộc cơ sở của nhân viên
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: Number(invoiceId),
      booking: { court: { facilityId: facilityStaff.facilityId } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Không tìm thấy hóa đơn" }, { status: 404 });

  const addedFee = services.reduce((sum: number, s: any) => sum + s.quantity * Number(s.price), 0);

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.createMany({
      data: services.map((s: any) => ({
        invoiceId: Number(invoiceId),
        serviceId: s.serviceId,
        quantity: s.quantity,
        price: Number(s.price),
      })),
    });

    await tx.invoice.update({
      where: { id: Number(invoiceId) },
      data: {
        subTotal: { increment: addedFee },
        finalTotal: { increment: addedFee },
      },
    });

    for (const s of services) {
      await tx.service.update({
        where: { id: s.serviceId },
        data: { stockQuantity: { decrement: s.quantity } },
      });
      await tx.stockLog.create({
        data: {
          serviceId: s.serviceId,
          type: "SOLD",
          quantity: s.quantity,
          note: `Hóa đơn #${invoiceId} (thêm dịch vụ)`,
        },
      });
    }
  });

  return NextResponse.json({ success: true });
}
