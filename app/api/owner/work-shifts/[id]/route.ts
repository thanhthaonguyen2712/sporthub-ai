import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/owner/work-shifts/[id] - Cập nhật ca hoặc duyệt đăng ký
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const shiftId = Number(id);
  const body = await req.json();

  // Duyệt đăng ký: { action: "approve"|"reject", registrationId }
  if (body.action === "approve" || body.action === "reject") {
    const shift = await prisma.workShift.findFirst({
      where: { id: shiftId, facility: { ownerId } },
    });
    if (!shift) return NextResponse.json({ error: "Không tìm thấy ca" }, { status: 404 });

    const reg = await prisma.shiftRegistration.update({
      where: { id: Number(body.registrationId) },
      data: { status: body.action === "approve" ? "APPROVED" : "REJECTED" },
    });
    return NextResponse.json({ success: true, registration: reg });
  }

  // Gán nhân viên vào ca: { action: "assign", staffId }
  if (body.action === "assign") {
    const shift = await prisma.workShift.findFirst({
      where: { id: shiftId, facility: { ownerId } },
    });
    if (!shift) return NextResponse.json({ error: "Không tìm thấy ca" }, { status: 404 });

    const reg = await prisma.shiftRegistration.upsert({
      where: { shiftId_staffId: { shiftId, staffId: Number(body.staffId) } },
      update: { status: "APPROVED" },
      create: { shiftId, staffId: Number(body.staffId), status: "APPROVED" },
    });
    return NextResponse.json({ success: true, registration: reg });
  }

  // Cập nhật ca
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, facility: { ownerId } },
  });
  if (!shift) return NextResponse.json({ error: "Không tìm thấy ca" }, { status: 404 });

  const updated = await prisma.workShift.update({
    where: { id: shiftId },
    data: {
      name: body.name ?? shift.name,
      shiftDate: body.shiftDate ? new Date(body.shiftDate) : shift.shiftDate,
      startTime: body.startTime ? new Date(`1970-01-01T${body.startTime}:00.000Z`) : shift.startTime,
      endTime: body.endTime ? new Date(`1970-01-01T${body.endTime}:00.000Z`) : shift.endTime,
      maxStaff: body.maxStaff !== undefined ? Number(body.maxStaff) : shift.maxStaff,
      status: body.status ?? shift.status,
      note: body.note !== undefined ? body.note : shift.note,
    },
  });

  return NextResponse.json({ success: true, shift: updated });
}

// DELETE /api/owner/work-shifts/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const shiftId = Number(id);

  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, facility: { ownerId } },
  });
  if (!shift) return NextResponse.json({ error: "Không tìm thấy ca" }, { status: 404 });

  await prisma.workShift.delete({ where: { id: shiftId } });
  return NextResponse.json({ success: true });
}
