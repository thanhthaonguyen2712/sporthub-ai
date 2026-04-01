import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH - Khóa / Mở khóa
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;

  const record = await prisma.facilityStaff.findFirst({
    where: { id: Number(id), facility: { ownerId } },
    include: { user: { select: { id: true, isLocked: true } } },
  });
  if (!record) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const newLocked = !record.user.isLocked;
  await prisma.user.update({ where: { id: record.user.id }, data: { isLocked: newLocked } });

  return NextResponse.json({ success: true, isLocked: newLocked });
}

// PUT - Sửa thông tin nhân viên + cấu hình lương
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const { fullName, phone, role, wageType, wageRate } = await req.json();

  const record = await prisma.facilityStaff.findFirst({
    where: { id: Number(id), facility: { ownerId } },
    include: { user: { select: { id: true } } },
  });
  if (!record) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const staffRole = role === "WAREHOUSE_MANAGER" ? "WAREHOUSE_MANAGER" : "STAFF";

  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: record.user.id },
      data: {
        ...(fullName && { fullName }),
        ...(phone && { phone }),
        role: staffRole,
      },
    });
    await tx.facilityStaff.update({
      where: { id: Number(id) },
      data: { role: staffRole },
    });
    if (wageRate && Number(wageRate) > 0) {
      await tx.staffWageConfig.upsert({
        where: { staffId_facilityId: { staffId: record.user.id, facilityId: record.facilityId } },
        update: { wageType: wageType || "HOURLY", wageRate: Number(wageRate) },
        create: { staffId: record.user.id, facilityId: record.facilityId, wageType: wageType || "HOURLY", wageRate: Number(wageRate) },
      });
    }
  });

  return NextResponse.json({ success: true });
}
