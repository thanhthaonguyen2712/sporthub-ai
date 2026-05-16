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

// PUT - Sửa thông tin nhân viên + lên lịch thay đổi lương/phân loại từ tháng sau
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
    include: {
      user: { select: { id: true, fullName: true, phone: true } },
      facility: { select: { id: true } },
    },
  });
  if (!record) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const currentRole = record.role;
  const currentConfig = await prisma.staffWageConfig.findUnique({
    where: { staffId_facilityId: { staffId: record.user.id, facilityId: record.facilityId } },
  });

  const newRole = role === "WAREHOUSE_MANAGER" ? "WAREHOUSE_MANAGER" : "STAFF";
  const newWageType = wageType || "HOURLY";
  const newWageRate = wageRate ? Number(wageRate) : 0;

  const roleChanged = newRole !== currentRole;
  const wageTypeChanged = currentConfig ? newWageType !== currentConfig.wageType : newWageType !== "HOURLY";
  const wageRateChanged = currentConfig ? Math.abs(newWageRate - Number(currentConfig.wageRate)) > 0.01 : newWageRate > 0;
  const wageOrRoleChanged = roleChanged || wageTypeChanged || wageRateChanged;

  // Tính effectiveFrom = ngày 1 tháng sau
  const now = new Date();
  const effectiveFrom = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await prisma.$transaction(async tx => {
    // 1. Cập nhật name/phone ngay lập tức
    await tx.user.update({
      where: { id: record.user.id },
      data: {
        ...(fullName && { fullName }),
        ...(phone && { phone }),
      },
    });

    // 2. Nếu lương hoặc phân loại thay đổi → tạo lịch sử, áp dụng từ tháng sau
    if (wageOrRoleChanged) {
      // Hủy bỏ các thay đổi chưa áp dụng cũ (nếu có) để tránh chồng lên nhau
      await tx.staffWageHistory.deleteMany({
        where: { staffId: record.user.id, facilityId: record.facilityId, isApplied: false },
      });

      await tx.staffWageHistory.create({
        data: {
          staffId: record.user.id,
          facilityId: record.facilityId,
          oldRole: roleChanged ? currentRole : null,
          newRole: roleChanged ? newRole : null,
          oldWageType: (wageTypeChanged || wageRateChanged) ? (currentConfig?.wageType ?? null) : null,
          newWageType: (wageTypeChanged || wageRateChanged) ? newWageType : null,
          oldWageRate: (wageTypeChanged || wageRateChanged) ? (currentConfig ? currentConfig.wageRate : null) : null,
          newWageRate: (wageTypeChanged || wageRateChanged) ? newWageRate : null,
          effectiveFrom,
          isApplied: false,
          changedBy: ownerId,
        },
      });
    }
  });

  return NextResponse.json({
    success: true,
    deferred: wageOrRoleChanged,
    effectiveFrom: wageOrRoleChanged ? effectiveFrom.toISOString() : null,
  });
}
