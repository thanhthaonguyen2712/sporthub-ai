import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!wallet) {
    // Tự tạo ví nếu chưa có (đồng bộ)
    const newWallet = await prisma.wallet.create({ data: { userId, balance: 0 } });
    return NextResponse.json({ balance: 0, status: newWallet.status, transactions: [] });
  }

  return NextResponse.json({
    balance: Number(wallet.balance),
    status: wallet.status,
    transactions: wallet.transactions.map(t => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
