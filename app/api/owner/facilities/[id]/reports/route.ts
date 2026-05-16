import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/owner/facilities/[id]/reports — lấy báo cáo sự cố của cơ sở
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const facilityId = Number(params.id);

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const reports = await prisma.staffReport.findMany({
    where: { facilityId },
    orderBy: { createdAt: "desc" },
    include: { staff: { select: { fullName: true } } },
  });

  return NextResponse.json(reports);
}

// PATCH /api/owner/facilities/[id]/reports — đánh dấu báo cáo đã giải quyết
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const facilityId = Number(params.id);

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const { reportId } = await req.json();
  if (!reportId) return NextResponse.json({ error: "Thiếu reportId" }, { status: 400 });

  await prisma.staffReport.update({
    where: { id: Number(reportId), facilityId },
    data: { status: "RESOLVED" },
  });

  return NextResponse.json({ success: true });
}
