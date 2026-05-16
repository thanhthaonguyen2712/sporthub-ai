import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/owner/vouchers/[id] - Toggle active / update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ownerId = Number((session.user as any).id);
    const { id } = await params;
    const body = await req.json();

    const voucher = await prisma.voucher.findFirst({ where: { id: Number(id), ownerId } });
    if (!voucher) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    const updated = await prisma.voucher.update({
      where: { id: Number(id) },
      data: {
        isActive: body.isActive !== undefined ? body.isActive : voucher.isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/owner/vouchers/[id] error:", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// DELETE /api/owner/vouchers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ownerId = Number((session.user as any).id);
    const { id } = await params;

    const voucher = await prisma.voucher.findFirst({ where: { id: Number(id), ownerId } });
    if (!voucher) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    await prisma.voucher.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/owner/vouchers/[id] error:", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
