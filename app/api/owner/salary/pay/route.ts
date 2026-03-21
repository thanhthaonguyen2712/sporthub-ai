import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { salaryRecordId } = await req.json();

  const record = await prisma.staffSalaryRecord.findFirst({
    where: { id: Number(salaryRecordId), facility: { ownerId } },
    include: { staff: { select: { id: true, fullName: true } } },
  });
  if (!record) return NextResponse.json({ error: "Không tìm thấy bảng lương" }, { status: 404 });
  if (record.isPaid) return NextResponse.json({ error: "Đã thanh toán rồi" }, { status: 400 });

  const amount = Number(record.finalSalary);

  const ownerWallet = await prisma.wallet.findUnique({ where: { userId: ownerId } });
  if (!ownerWallet || Number(ownerWallet.balance) < amount) {
    return NextResponse.json({ error: "Số dư ví không đủ để thanh toán lương" }, { status: 400 });
  }

  let staffWallet = await prisma.wallet.findUnique({ where: { userId: record.staffId } });
  if (!staffWallet) {
    staffWallet = await prisma.wallet.create({ data: { userId: record.staffId } });
  }

  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: ownerWallet.id },
      data: { balance: { decrement: amount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: ownerWallet.id,
        amount,
        type: "PAYMENT",
        description: `Trả lương tháng ${record.month}/${record.year} cho ${record.staff.fullName}`,
      },
    }),
    prisma.wallet.update({
      where: { id: staffWallet.id },
      data: { balance: { increment: amount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: staffWallet.id,
        amount,
        type: "DEPOSIT",
        description: `Lương tháng ${record.month}/${record.year}`,
      },
    }),
    prisma.staffSalaryRecord.update({
      where: { id: record.id },
      data: { isPaid: true, paidAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
