import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { name, type, price, stockQuantity, monthlyThreshold, isActive, imageUrl } = await req.json();

  const service = await prisma.service.findFirst({
    where: { id: Number(id), facility: { ownerId } },
  });
  if (!service) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const updated = await prisma.service.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(price !== undefined && { price: Number(price) }),
      ...(stockQuantity !== undefined    && { stockQuantity:    Number(stockQuantity) }),
      ...(monthlyThreshold !== undefined && { monthlyThreshold: Number(monthlyThreshold) }),
      ...(isActive !== undefined         && { isActive }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
    },
  });

  return NextResponse.json({ success: true, service: updated });
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

  const service = await prisma.service.findFirst({
    where: { id: Number(id), facility: { ownerId } },
  });
  if (!service) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  await prisma.service.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
