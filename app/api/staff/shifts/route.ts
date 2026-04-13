import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/staff/shifts?startDate=&endDate= - Xem ca làm + trạng thái đăng ký
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Lấy cơ sở của nhân viên
  const facilityStaff = await prisma.facilityStaff.findFirst({
    where: { userId },
    select: { facilityId: true },
  });
  if (!facilityStaff) return NextResponse.json([]);

  const where: any = { facilityId: facilityStaff.facilityId };
  if (startDate && endDate) {
    where.shiftDate = { gte: new Date(startDate), lte: new Date(endDate) };
  } else {
    // Mặc định lấy 2 tuần tiếp theo
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 86400000);
    where.shiftDate = { gte: now, lte: twoWeeks };
  }

  const shifts = await prisma.workShift.findMany({
    where,
    include: {
      registrations: {
        where: { staffId: userId },
        select: { id: true, status: true },
      },
      _count: { select: { registrations: { where: { status: "APPROVED" } } } },
    },
    orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(shifts.map(s => ({
    id: s.id,
    name: s.name,
    shiftDate: s.shiftDate,
    startTime: s.startTime,
    endTime: s.endTime,
    maxStaff: s.maxStaff,
    status: s.status,
    note: s.note,
    approvedCount: s._count.registrations,
    myRegistration: s.registrations[0] || null,
  })));
}

// POST /api/staff/shifts - Đăng ký ca
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { shiftId, note } = await req.json();

  const shift = await prisma.workShift.findUnique({ where: { id: Number(shiftId) } });
  if (!shift) return NextResponse.json({ error: "Không tìm thấy ca" }, { status: 404 });
  if (shift.status === "CLOSED") return NextResponse.json({ error: "Ca đã đóng đăng ký" }, { status: 400 });

  // Kiểm tra nhân viên thuộc cơ sở của ca
  const facilityStaff = await prisma.facilityStaff.findFirst({
    where: { userId, facilityId: shift.facilityId },
  });
  if (!facilityStaff) return NextResponse.json({ error: "Bạn không thuộc cơ sở này" }, { status: 403 });

  const existing = await prisma.shiftRegistration.findUnique({
    where: { shiftId_staffId: { shiftId: Number(shiftId), staffId: userId } },
  });
  if (existing) return NextResponse.json({ error: "Bạn đã đăng ký ca này rồi" }, { status: 400 });

  const reg = await prisma.shiftRegistration.create({
    data: { shiftId: Number(shiftId), staffId: userId, note: note || null },
  });

  return NextResponse.json({ success: true, registration: reg }, { status: 201 });
}

// DELETE /api/staff/shifts?shiftId= - Hủy đăng ký ca
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const shiftId = Number(req.nextUrl.searchParams.get("shiftId"));

  const reg = await prisma.shiftRegistration.findUnique({
    where: { shiftId_staffId: { shiftId, staffId: userId } },
  });
  if (!reg) return NextResponse.json({ error: "Không tìm thấy đăng ký" }, { status: 404 });
  if (reg.status === "APPROVED") return NextResponse.json({ error: "Ca đã được duyệt, không thể hủy" }, { status: 400 });

  await prisma.shiftRegistration.delete({
    where: { shiftId_staffId: { shiftId, staffId: userId } },
  });

  return NextResponse.json({ success: true });
}
