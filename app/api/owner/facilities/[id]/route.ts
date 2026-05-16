import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const facilityId = Number(params.id);

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const body = await req.json();
  const updateData: Record<string, any> = {};

  if (body.annualRevenuePlan !== undefined) {
    updateData.annualRevenuePlan = body.annualRevenuePlan > 0 ? body.annualRevenuePlan : null;
  }
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const updated = await prisma.facility.update({ where: { id: facilityId }, data: updateData });
  return NextResponse.json({ success: true, facility: updated });
}
