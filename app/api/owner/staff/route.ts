import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const facilityId = req.nextUrl.searchParams.get("facilityId");

  const where = facilityId
    ? { facilityId: Number(facilityId), facility: { ownerId } }
    : { facility: { ownerId } };

  const staff = await prisma.facilityStaff.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true } },
      facility: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    staff.map((s) => ({
      staffRecordId: s.id,
      facilityId: s.facilityId,
      facilityName: s.facility.name,
      role: s.role,
      joinedAt: s.createdAt,
      user: s.user,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, fullName, email, phone, password, role } = await req.json();

  if (!facilityId || !fullName || !email || !phone || !password) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (existing) return NextResponse.json({ error: "Email hoặc SĐT đã tồn tại" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 10);
  const staffRole = role === "WAREHOUSE_MANAGER" ? "WAREHOUSE_MANAGER" : "STAFF";

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        fullName,
        email,
        phone,
        password: hashed,
        role: staffRole,
      },
    });
    await tx.wallet.create({ data: { userId: newUser.id } });
    await tx.facilityStaff.create({
      data: { facilityId: Number(facilityId), userId: newUser.id, role: staffRole },
    });
    return newUser;
  });

  return NextResponse.json({ success: true, userId: user.id });
}
