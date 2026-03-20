import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    // Lấy voucher của owner (nếu là owner)
    // + voucher public còn hiệu lực
    const vouchers = await prisma.voucher.findMany({
      where: {
        isActive: true,
        endDate: { gte: new Date() },
      },
      orderBy: { endDate: "asc" },
    });

    return NextResponse.json(vouchers);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
