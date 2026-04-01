import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const facilityId = Number(req.nextUrl.searchParams.get("facilityId"));

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const services = await prisma.service.findMany({
    where: { facilityId },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, name, type, price, stockQuantity, imageUrl } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const service = await prisma.service.create({
    data: {
      facilityId: Number(facilityId),
      name,
      type: type === "RENTAL" ? "RENTAL" : "PRODUCT",
      price: Number(price),
      stockQuantity: Number(stockQuantity || 0),
      ...(imageUrl ? { imageUrl } : {}),
    },
  });

  return NextResponse.json({ success: true, service });
}
