import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
}

// Haversine — trả về khoảng cách mét
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAX_DISTANCE_METERS = 300;

async function getStaffFacility(userId: number) {
  return prisma.facilityStaff.findFirst({
    where: { userId },
    include: { facility: { select: { name: true, latitude: true, longitude: true } } },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const record = await prisma.staffAttendance.findFirst({
    where: { staffId: userId, date: todayRange() },
  });
  return NextResponse.json(record || null);
}

// Check-in
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { latitude, longitude } = await req.json().catch(() => ({}));

  if (latitude == null || longitude == null) {
    return NextResponse.json({ error: "NO_LOCATION" }, { status: 400 });
  }

  // Kiểm tra vị trí
  const fs = await getStaffFacility(userId);
  if (!fs) return NextResponse.json({ error: "Chưa được gắn vào cơ sở" }, { status: 403 });

  const { facility } = fs;
  if (!facility.latitude || !facility.longitude) {
    return NextResponse.json({ error: "NO_FACILITY_LOCATION" }, { status: 400 });
  }

  const distance = haversineMeters(
    latitude, longitude,
    Number(facility.latitude), Number(facility.longitude)
  );

  if (distance > MAX_DISTANCE_METERS) {
    return NextResponse.json({
      error: "OUT_OF_RANGE",
      distance: Math.round(distance),
      max: MAX_DISTANCE_METERS,
      facilityName: facility.name,
    }, { status: 403 });
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: { staffId: userId, date: todayRange() },
  });
  if (existing) return NextResponse.json({ error: "Đã check-in hôm nay" }, { status: 400 });

  const now = new Date();
  const todayDate = new Date(now);
  todayDate.setHours(0, 0, 0, 0);

  const record = await prisma.staffAttendance.create({
    data: { staffId: userId, date: todayDate, checkInTime: now, status: "WORKING" },
  });
  return NextResponse.json(record, { status: 201 });
}

// Check-out
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { latitude, longitude } = await req.json().catch(() => ({}));

  if (latitude == null || longitude == null) {
    return NextResponse.json({ error: "NO_LOCATION" }, { status: 400 });
  }

  const fs = await getStaffFacility(userId);
  if (!fs) return NextResponse.json({ error: "Chưa được gắn vào cơ sở" }, { status: 403 });

  const { facility } = fs;
  if (!facility.latitude || !facility.longitude) {
    return NextResponse.json({ error: "NO_FACILITY_LOCATION" }, { status: 400 });
  }

  const distance = haversineMeters(
    latitude, longitude,
    Number(facility.latitude), Number(facility.longitude)
  );

  if (distance > MAX_DISTANCE_METERS) {
    return NextResponse.json({
      error: "OUT_OF_RANGE",
      distance: Math.round(distance),
      max: MAX_DISTANCE_METERS,
      facilityName: facility.name,
    }, { status: 403 });
  }

  const record = await prisma.staffAttendance.findFirst({
    where: { staffId: userId, date: todayRange() },
  });
  if (!record) return NextResponse.json({ error: "Chưa check-in hôm nay" }, { status: 400 });
  if (record.status === "COMPLETED") return NextResponse.json({ error: "Đã check-out rồi" }, { status: 400 });

  const now = new Date();
  const checkInMs = record.checkInTime ? record.checkInTime.getTime() : now.getTime();
  const totalHours = Math.round(((now.getTime() - checkInMs) / 3600000) * 100) / 100;

  const updated = await prisma.staffAttendance.update({
    where: { id: record.id },
    data: { checkOutTime: now, totalHours, status: "COMPLETED" },
  });
  return NextResponse.json(updated);
}
