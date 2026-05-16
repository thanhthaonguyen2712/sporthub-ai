import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Lấy thông tin ví kinh doanh (tự tạo nếu chưa có)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number((session.user as any).id);

  // Tự tạo ví kinh doanh nếu chưa tồn tại
  let wallet = await prisma.businessWallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.businessWallet.create({
      data: { userId, balance: 0, status: "ACTIVE" },
    });
  }

  const transactions = await prisma.businessWalletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    wallet: {
      id: wallet.id,
      balance: wallet.balance,
      status: wallet.status,
    },
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
    })),
  });
}

// POST: Ghi nhận thanh toán thủ công vào ví kinh doanh
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number((session.user as any).id);
  const { amount, description, type } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
  }

  let wallet = await prisma.businessWallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.businessWallet.create({
      data: { userId, balance: 0, status: "ACTIVE" },
    });
  }

  const transType = type === "WITHDRAW" ? "WITHDRAW" : "DEPOSIT";
  const newBalance =
    transType === "DEPOSIT"
      ? Number(wallet.balance) + Number(amount)
      : Number(wallet.balance) - Number(amount);

  if (newBalance < 0) {
    return NextResponse.json({ error: "Số dư không đủ" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.businessWallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    }),
    prisma.businessWalletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: Number(amount),
        type: transType,
        description: description || null,
      },
    }),
  ]);

  return NextResponse.json({ success: true, newBalance });
}
