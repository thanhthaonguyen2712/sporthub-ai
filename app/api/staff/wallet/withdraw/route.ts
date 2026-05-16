import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_WITHDRAW = 50_000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const userId = Number((session.user as any).id);
  const { amount, bankAccountId } = await req.json();
  const withdrawAmount = Number(amount);

  if (!withdrawAmount || withdrawAmount < MIN_WITHDRAW)
    return NextResponse.json({ error: `Số tiền rút tối thiểu là ${MIN_WITHDRAW.toLocaleString("vi-VN")}đ` }, { status: 400 });

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: Number(bankAccountId) } });
  if (!bankAccount || bankAccount.userId !== userId)
    return NextResponse.json({ error: "Tài khoản ngân hàng không hợp lệ" }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return NextResponse.json({ error: "Không tìm thấy ví" }, { status: 404 });
  if (wallet.status === "LOCKED") return NextResponse.json({ error: "Ví đang bị khóa" }, { status: 400 });
  if (Number(wallet.balance) < withdrawAmount)
    return NextResponse.json({ error: "Số dư không đủ" }, { status: 400 });

  const [bankBin, bankLabel] = bankAccount.bankName.split("|");
  const desc = `Rút tiền về ${bankLabel ?? bankBin} - ${bankAccount.accountNumber} (${bankAccount.accountName})`;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: withdrawAmount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: withdrawAmount,
        type: "WITHDRAW",
        description: desc,
      },
    }),
  ]);

  return NextResponse.json({ success: true, newBalance: Number(wallet.balance) - withdrawAmount });
}
