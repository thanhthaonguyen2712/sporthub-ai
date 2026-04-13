import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);

  const facilities = await prisma.facility.findMany({
    where: { ownerId },
    include: {
      courts: { where: { isActive: true }, select: { id: true } },
      facilityStaff: { select: { id: true } },
      facilitySports: { include: { sportCategory: { select: { id: true, name: true } } } },
    },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(
    facilities.map((f) => ({
      id: f.id,
      name: f.name,
      address: f.address,
      description: f.description,
      imageUrl: f.imageUrl,
      isActive: f.isActive,
      courtCount: f.courts.length,
      staffCount: f.facilityStaff.length,
      sports: f.facilitySports.map((fs) => fs.sportCategory),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { name, address, description, latitude, longitude, sportIds, imageUrl } = await req.json();
  if (!name || !address) return NextResponse.json({ error: "Thiếu tên hoặc địa chỉ" }, { status: 400 });

  const facility = await prisma.facility.create({
    data: {
      name,
      address,
      description: description || null,
      imageUrl: imageUrl || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      ownerId,
      facilitySports: sportIds?.length
        ? { create: (sportIds as number[]).map((id) => ({ sportCategoryId: id })) }
        : undefined,
    },
  });

  return NextResponse.json({ success: true, facilityId: facility.id });
}
