import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PUT: cập nhật items + đóng ca
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "WAREHOUSE_MANAGER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const shiftId = Number(id);

  const shift = await prisma.inventoryShift.findUnique({
    where: { id: shiftId },
    include: { items: true },
  });
  if (!shift) return NextResponse.json({ error: "Không tìm thấy ca kiểm kê" }, { status: 404 });
  if (shift.managerId !== userId) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  if (shift.status !== "OPEN") return NextResponse.json({ error: "Ca này đã đóng rồi" }, { status: 400 });

  const body = await req.json();
  const { action, items, notes } = body as {
    action: "save" | "close";
    items: { id: number; sold: number; returned: number; closingStock: number | null; notes?: string }[];
    notes?: string;
  };

  // Cập nhật từng item
  const updateOps = items.map(item => {
    const shiftItem = shift.items.find(i => i.id === item.id);
    const closing = item.closingStock ?? null;
    const discrepancy =
      closing !== null && shiftItem
        ? shiftItem.openingStock - item.sold + item.returned - closing
        : null;

    return prisma.inventoryShiftItem.update({
      where: { id: item.id },
      data: {
        sold: item.sold,
        returned: item.returned,
        closingStock: closing,
        discrepancy,
        notes: item.notes || null,
      },
    });
  });

  if (action === "close") {
    // Đóng ca: cập nhật items + status CLOSED
    await prisma.$transaction([
      ...updateOps,
      prisma.inventoryShift.update({
        where: { id: shiftId },
        data: { status: "CLOSED", closedAt: new Date(), notes: notes || shift.notes },
      }),
    ]);
  } else {
    // Lưu tạm
    await prisma.$transaction(updateOps);
  }

  const updated = await prisma.inventoryShift.findUnique({
    where: { id: shiftId },
    include: {
      items: {
        include: { service: { select: { name: true, type: true } } },
        orderBy: { service: { name: "asc" } },
      },
    },
  });

  return NextResponse.json(updated);
}
