import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/owner/courts/[id]/lock - Danh sách khóa sân
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const courtId = Number(id);

  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { ownerId } },
  });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  const locks = await prisma.courtLock.findMany({
    where: { courtId, isActive: true },
    include: { locker: { select: { fullName: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(locks);
}

// POST /api/owner/courts/[id]/lock - Khóa sân
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const lockedBy = Number((session.user as any).id);
  const { id } = await params;
  const courtId = Number(id);
  const { reason, note, startDate, endDate, notifyCustomers } = await req.json();

  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { ownerId } },
    include: { facility: true },
  });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  const lock = await prisma.courtLock.create({
    data: {
      courtId,
      reason,
      note: note || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      lockedBy,
    },
  });

  // Thông báo khách hàng có lịch đặt trong thời gian khóa
  if (notifyCustomers) {
    const affectedBookings = await prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        status: { in: ["PENDING", "CONFIRMED"] },
        customerId: { not: null },
      },
      include: { customer: { select: { id: true, fullName: true } } },
    });

    const reasonLabel: Record<string, string> = {
      INCIDENT: "sự cố",
      MONTHLY_RENTAL: "thuê bao tháng",
      ANNUAL_RENTAL: "thuê bao năm",
      MAINTENANCE: "bảo trì",
    };

    for (const booking of affectedBookings) {
      if (booking.customerId) {
        await prisma.notification.create({
          data: {
            userId: booking.customerId,
            title: "Sân bị khóa",
            content: `Sân ${court.name} tại ${court.facility.name} bị khóa từ ${new Date(startDate).toLocaleDateString("vi-VN")} đến ${new Date(endDate).toLocaleDateString("vi-VN")} do ${reasonLabel[reason] || reason}. Lịch đặt của bạn có thể bị ảnh hưởng. Vui lòng liên hệ cơ sở để được hoàn tiền hoặc đổi lịch.`,
            type: "BOOKING",
          },
        });
      }
    }
  }

  return NextResponse.json({ success: true, lock }, { status: 201 });
}

// DELETE /api/owner/courts/[id]/lock?lockId= - Mở khóa sân
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const courtId = Number(id);
  const lockId = Number(req.nextUrl.searchParams.get("lockId"));

  const court = await prisma.court.findFirst({ where: { id: courtId, facility: { ownerId } } });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  await prisma.courtLock.update({ where: { id: lockId }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
