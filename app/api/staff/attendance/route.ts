import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Tính ngày hôm nay theo giờ Việt Nam (UTC+7) và trả về midnight UTC
// để tránh lỗi khi PostgreSQL chạy timezone UTC khác server
function vnMidnightUTC(): Date {
  const vn = new Date(Date.now() + 7 * 3600 * 1000); // shift sang UTC+7
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}

function todayRange() {
  const start = vnMidnightUTC();
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
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
  void req;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const existing = await prisma.staffAttendance.findFirst({
    where: { staffId: userId, date: todayRange() },
  });
  if (existing) return NextResponse.json({ error: "Đã check-in hôm nay" }, { status: 400 });

  const now = new Date();
  const todayDate = vnMidnightUTC();

  const record = await prisma.staffAttendance.create({
    data: { staffId: userId, date: todayDate, checkInTime: now, status: "WORKING" },
  });
  return NextResponse.json(record, { status: 201 });
}

// Check-out
export async function PUT(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

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
