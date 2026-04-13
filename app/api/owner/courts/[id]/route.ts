import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/owner/courts/[id] - Cập nhật pricing rules cho sân
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;
  const { pricingRules } = await req.json();
  // pricingRules: Array<{ id?, startTime, endTime, pricePerHour, dayType, isPeak, priority }>

  const court = await prisma.court.findFirst({
    where: { id: Number(id), facility: { ownerId } },
  });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  // Xóa toàn bộ pricing rules cũ rồi tạo lại
  await prisma.courtPricingRule.deleteMany({ where: { courtId: Number(id) } });
  await prisma.courtPricingRule.createMany({
    data: pricingRules.map((r: any, idx: number) => ({
      courtId: Number(id),
      startTime: new Date(`1970-01-01T${r.startTime}:00.000Z`),
      endTime: new Date(`1970-01-01T${r.endTime}:00.000Z`),
      pricePerHour: Number(r.pricePerHour),
      dayType: r.dayType,
      isPeak: r.isPeak ?? false,
      priority: r.priority ?? (r.isPeak ? 1 : 0),
    })),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { id } = await params;

  const court = await prisma.court.findFirst({
    where: { id: Number(id), facility: { ownerId } },
  });
  if (!court) return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });

  await prisma.court.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
