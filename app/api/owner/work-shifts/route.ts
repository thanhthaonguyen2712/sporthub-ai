import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/owner/work-shifts?facilityId=&startDate=&endDate=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { searchParams } = req.nextUrl;
  const facilityId = Number(searchParams.get("facilityId"));
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  const where: any = { facilityId };
  if (startDate && endDate) {
    where.shiftDate = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  try {
    const shifts = await prisma.workShift.findMany({
      where,
      include: {
        registrations: {
          include: { staff: { select: { id: true, fullName: true, phone: true } } },
        },
      },
      orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json(shifts);
  } catch (err) {
    console.error("work-shifts GET error:", err);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

// POST /api/owner/work-shifts - Tạo ca làm hàng loạt theo khoảng ngày
// Body: { facilityId, name, fromDate, toDate, daysOfWeek: number[], startTime, endTime, maxStaff, note }
// daysOfWeek: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, name, fromDate, toDate, daysOfWeek, startTime, endTime, maxStaff, note } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  const days: number[] = Array.isArray(daysOfWeek) && daysOfWeek.length > 0
    ? daysOfWeek
    : [0, 1, 2, 3, 4, 5, 6]; // mặc định tất cả các ngày

  // Sinh tất cả ngày trong khoảng fromDate → toDate khớp với daysOfWeek
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const shiftDates: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    if (days.includes(cur.getDay())) {
      shiftDates.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (shiftDates.length === 0) {
    return NextResponse.json({ error: "Không có ngày nào phù hợp với lựa chọn" }, { status: 400 });
  }

  try {
    const startTimeDate = new Date(`1970-01-01T${startTime}:00.000Z`);
    const endTimeDate   = new Date(`1970-01-01T${endTime}:00.000Z`);
    const maxStaffNum   = Number(maxStaff) || 5;

    await prisma.workShift.createMany({
      data: shiftDates.map(d => ({
        facilityId: Number(facilityId),
        name,
        shiftDate: d,
        startTime: startTimeDate,
        endTime: endTimeDate,
        maxStaff: maxStaffNum,
        note: note || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, created: shiftDates.length }, { status: 201 });
  } catch (err) {
    console.error("work-shifts POST error:", err);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

// DELETE /api/owner/work-shifts?facilityId=&fromDate=&toDate= - Xóa hàng loạt ca trong khoảng ngày
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { searchParams } = req.nextUrl;
  const facilityId = Number(searchParams.get("facilityId"));
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const name = searchParams.get("name"); // optional: xóa theo tên ca

  const facility = await prisma.facility.findFirst({ where: { id: facilityId, ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  const where: any = { facilityId };
  if (fromDate && toDate) {
    where.shiftDate = { gte: new Date(fromDate), lte: new Date(toDate) };
  }
  if (name) where.name = name;

  try {
    const { count } = await prisma.workShift.deleteMany({ where });
    return NextResponse.json({ success: true, deleted: count });
  } catch (err) {
    console.error("work-shifts DELETE error:", err);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
