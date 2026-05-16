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
      defaultQrUrl: f.defaultQrUrl,
      isActive: f.isActive,
      annualRevenuePlan: f.annualRevenuePlan,
      courtCount: f.courts.length,
      staffCount: f.facilityStaff.length,
      sports: f.facilitySports.map((fs) => fs.sportCategory),
    }))
  );
}

function stripAdminPrefixes(text: string): string {
  return text
    .replace(
      /^(Thành phố|Thành Phố|TP\.|TP |Tỉnh|Quận|Huyện|Thị xã|Thị Xã|Thị trấn|Thị Trấn|Phường|Xã)\s+/gi,
      ""
    )
    .trim();
}

async function nominatimSearch(query: string): Promise<{ lat: string; lon: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`,
    {
      headers: {
        "Accept-Language": "vi",
        "User-Agent": "SportHubAI/1.0 (sports-court-booking-app)",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) return { lat: data[0].lat, lon: data[0].lon };
  return null;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const simplified = address.trim().split(", ").map(stripAdminPrefixes).filter(Boolean).join(", ");
    const parts = simplified.split(", ").filter(Boolean);
    const candidates = [
      simplified + ", Việt Nam",
      parts.length >= 3 ? parts.slice(1).join(", ") + ", Việt Nam" : "",
      parts.length >= 2 ? parts.slice(-2).join(", ") + ", Việt Nam" : "",
    ].filter(Boolean);

    for (const candidate of candidates) {
      const result = await nominatimSearch(candidate);
      if (result) return { lat: Number(result.lat), lng: Number(result.lon) };
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { name, address, description, latitude, longitude, sportIds, imageUrl } = await req.json();
  if (!name || !address) return NextResponse.json({ error: "Thiếu tên hoặc địa chỉ" }, { status: 400 });

  // Nếu chưa có tọa độ, tự động geocode từ địa chỉ
  let finalLat = latitude ? Number(latitude) : null;
  let finalLng = longitude ? Number(longitude) : null;
  if (!finalLat || !finalLng) {
    const coords = await geocodeAddress(address);
    if (coords) {
      finalLat = coords.lat;
      finalLng = coords.lng;
    }
  }

  const facility = await prisma.facility.create({
    data: {
      name,
      address,
      description: description || null,
      imageUrl: imageUrl || null,
      latitude: finalLat,
      longitude: finalLng,
      ownerId,
      facilitySports: sportIds?.length
        ? { create: (sportIds as number[]).map((id) => ({ sportCategoryId: id })) }
        : undefined,
    },
  });

  return NextResponse.json({ success: true, facilityId: facility.id });
}
