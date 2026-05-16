import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ownerId = Number((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const facilityIdParam = searchParams.get("facilityId");
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : null;
    const year  = searchParams.get("year")  ? Number(searchParams.get("year"))  : null;

    // Lấy tất cả cơ sở của owner để build map tên
    const ownerFacilities = await prisma.facility.findMany({
      where: { ownerId },
      select: { id: true, name: true },
    });
    const facilityNameMap: Record<number, string> = {};
    ownerFacilities.forEach(f => { facilityNameMap[f.id] = f.name; });
    const allFacilityIds = ownerFacilities.map(f => f.id);

    // Xác minh cơ sở nếu có filter
    let filterFacilityId: number | null = null;
    if (facilityIdParam) {
      const fid = Number(facilityIdParam);
      if (!allFacilityIds.includes(fid)) {
        return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });
      }
      filterFacilityId = fid;
    }

    // Lấy hoặc tạo ví kinh doanh
    let bizWallet = await prisma.businessWallet.findUnique({ where: { userId: ownerId } });
    if (!bizWallet) {
      bizWallet = await prisma.businessWallet.create({ data: { userId: ownerId, balance: 0, status: "ACTIVE" } });
    }

    // Xây dựng điều kiện truy vấn
    const where: any = { walletId: bizWallet.id };
    if (filterFacilityId !== null) {
      where.facilityId = filterFacilityId;
    }
    if (month && year) {
      where.createdAt = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const transactions = await prisma.businessWalletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const totalIn     = transactions.filter(t => t.type === "DEPOSIT").reduce((s, t) => s + Number(t.amount), 0);
    const totalOut    = transactions.filter(t => t.type === "WITHDRAW").reduce((s, t) => s + Number(t.amount), 0);
    const totalRefund = transactions.filter(t => t.type === "REFUND").reduce((s, t) => s + Number(t.amount), 0);

    // Tính số dư thực (toàn bộ lịch sử, không filter) để sync DB
    const allTransactions = await prisma.businessWalletTransaction.findMany({
      where: { walletId: bizWallet.id },
      select: { type: true, amount: true },
    });
    const walletBalance = allTransactions.reduce((s, t) => {
      if (t.type === "DEPOSIT") return s + Number(t.amount);
      return s - Number(t.amount);
    }, 0);

    // Đồng bộ lại balance trong DB nếu lệch
    if (walletBalance !== Number(bizWallet.balance)) {
      await prisma.businessWallet.update({
        where: { id: bizWallet.id },
        data: { balance: walletBalance },
      });
    }

    // balance = thực nhận trong phạm vi filter (= số hiển thị ở card số dư)
    const balance = totalIn - totalOut - totalRefund;

    return NextResponse.json({
      balance,        // thực nhận theo filter (hiển thị ở card)
      walletBalance,  // số dư tích lũy toàn thời gian (dùng cho nạp/rút)
      totalIn,
      totalOut,
      totalRefund,
      transactions: transactions.map(t => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type,
        description: t.description,
        createdAt: t.createdAt,
        facilityId: t.facilityId,
        facilityName: t.facilityId ? (facilityNameMap[t.facilityId] ?? null) : null,
      })),
    });
  } catch (err) {
    console.error("[cashflow]", err);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
