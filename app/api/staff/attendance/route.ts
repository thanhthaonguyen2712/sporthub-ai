import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function vnMidnightUTC(): Date {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
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
    include: {
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });
  return NextResponse.json(record || null);
}

// Chấm công vào ca (check-in)
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

  // Tìm ca làm hôm nay của nhân viên (đã được duyệt)
  const todayShift = await prisma.shiftRegistration.findFirst({
    where: {
      staffId: userId,
      status: "APPROVED",
      shift: { shiftDate: { gte: todayDate, lt: new Date(todayDate.getTime() + 86400000) } },
    },
    include: { shift: true },
  });

  // Xác định check-in trễ (so với giờ bắt đầu ca, hoặc 8:00 mặc định)
  let isLate = false;
  if (todayShift?.shift) {
    const shiftStart = todayShift.shift.startTime as Date;
    const shiftStartMs = todayDate.getTime()
      + shiftStart.getUTCHours() * 3600000
      + shiftStart.getUTCMinutes() * 60000;
    // Trễ nếu check-in sau 5 phút so với giờ bắt đầu ca
    isLate = now.getTime() > shiftStartMs + 5 * 60000;
  } else {
    // Mặc định: trễ nếu sau 8:00
    const nowVn = new Date(now.getTime() + 7 * 3600000);
    const h = nowVn.getUTCHours();
    const m = nowVn.getUTCMinutes();
    isLate = h > 8 || (h === 8 && m > 0);
  }

  const record = await prisma.staffAttendance.create({
    data: {
      staffId: userId,
      date: todayDate,
      checkInTime: now,
      status: "WORKING",
      isLate,
      shiftId: todayShift?.shiftId ?? null,
    },
  });
  return NextResponse.json(record, { status: 201 });
}

// Chấm công ra ca (check-out)
export async function PUT(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  try {
    const record = await prisma.staffAttendance.findFirst({
      where: { staffId: userId, date: todayRange() },
      include: { shift: true },
    });
    if (!record) return NextResponse.json({ error: "Chưa check-in hôm nay" }, { status: 400 });
    if (record.status === "COMPLETED") return NextResponse.json({ error: "Đã check-out rồi" }, { status: 400 });

    const now = new Date();
    const todayDate = vnMidnightUTC();

    let totalHours = 0;
    if (record.checkInTime) {
      const t = record.checkInTime as Date;
      const checkInMs = todayDate.getTime()
        + t.getUTCHours() * 3600000
        + t.getUTCMinutes() * 60000
        + t.getUTCSeconds() * 1000;
      totalHours = Math.max(0, Math.round(((now.getTime() - checkInMs) / 3600000) * 100) / 100);
    }

    // Tính overtime nếu có ca và check-out trễ hơn giờ kết thúc ca
    let overtimeMinutes = 0;
    if (record.shift) {
      const shiftEnd = record.shift.endTime as Date;
      const shiftEndMs = todayDate.getTime()
        + shiftEnd.getUTCHours() * 3600000
        + shiftEnd.getUTCMinutes() * 60000;
      const diff = now.getTime() - shiftEndMs;
      if (diff > 0) {
        overtimeMinutes = Math.floor(diff / 60000);
      }
    }

    const updated = await prisma.staffAttendance.update({
      where: { id: record.id },
      data: { checkOutTime: now, totalHours, status: "COMPLETED", overtimeMinutes },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/staff/attendance error:", err);
    return NextResponse.json({ error: "Lỗi máy chủ khi check-out." }, { status: 500 });
  }
}
