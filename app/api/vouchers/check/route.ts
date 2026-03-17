import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const total = Number(searchParams.get("total") || 0);

    if (!code) {
      return NextResponse.json({ error: "Thiếu mã voucher" }, { status: 400 });
    }

    const voucher = await prisma.voucher.findFirst({
      where: {
        code,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    if (!voucher || voucher.usedCount >= voucher.usageLimit) {
      return NextResponse.json({ error: "Voucher không hợp lệ hoặc đã hết hạn" }, { status: 400 });
    }

    if (total < Number(voucher.minOrderValue)) {
      return NextResponse.json({
        error: `Đơn hàng tối thiểu ${Number(voucher.minOrderValue).toLocaleString("vi-VN")}đ`,
      }, { status: 400 });
    }

    let discount = 0;
    if (voucher.discountType === "PERCENT") {
      discount = (total * Number(voucher.discountValue)) / 100;
      if (voucher.maxDiscount && discount > Number(voucher.maxDiscount)) {
        discount = Number(voucher.maxDiscount);
      }
    } else {
      discount = Number(voucher.discountValue);
    }

    return NextResponse.json({
      discount,
      code: voucher.code,
      description: voucher.discountType === "PERCENT"
        ? `Giảm ${voucher.discountValue}%`
        : `Giảm ${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}