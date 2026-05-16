import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/owner/vouchers - List all vouchers of this owner
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ownerId = Number((session.user as any).id);

    const vouchers = await prisma.voucher.findMany({
      where: { ownerId },
      include: { facility: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(vouchers);
  } catch (e) {
    console.error("GET /api/owner/vouchers error:", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// POST /api/owner/vouchers - Create a voucher
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ownerId = Number((session.user as any).id);
    const body = await req.json();
    const { code, name, discountType, discountValue, minOrderValue, maxDiscount, startDate, endDate, usageLimit, facilityId, requiredMembershipTier } = body;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    // Kiểm tra cơ sở thuộc quyền sở hữu của chủ (nếu có facilityId)
    if (facilityId) {
      const fac = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
      if (!fac) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });
    }

    const existing = await prisma.voucher.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) return NextResponse.json({ error: "Mã voucher đã tồn tại" }, { status: 400 });

    const voucher = await prisma.voucher.create({
      data: {
        code: code.toUpperCase(),
        name: name || null,
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue || 0),
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        usageLimit: Number(usageLimit || 1),
        ownerId,
        facilityId: facilityId ? Number(facilityId) : null,
        requiredMembershipTier: requiredMembershipTier || null,
      },
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (e) {
    console.error("POST /api/owner/vouchers error:", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
