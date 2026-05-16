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

  // Mặc định dùng ví kinh doanh để trả lương
  let businessWallet = await prisma.businessWallet.findUnique({ where: { userId: ownerId } });
  if (!businessWallet) {
    businessWallet = await prisma.businessWallet.create({
      data: { userId: ownerId, balance: 0, status: "ACTIVE" },
    });
  }
  if (Number(businessWallet.balance) < amount) {
    return NextResponse.json({ error: "Số dư ví kinh doanh không đủ để thanh toán lương" }, { status: 400 });
  }

  // Staff nhận lương vào ví cá nhân
  let staffWallet = await prisma.wallet.findUnique({ where: { userId: record.staffId } });
  if (!staffWallet) {
    staffWallet = await prisma.wallet.create({ data: { userId: record.staffId } });
  }

  await prisma.$transaction([
    // Trừ ví kinh doanh của owner
    prisma.businessWallet.update({
      where: { id: businessWallet.id },
      data: { balance: { decrement: amount } },
    }),
    prisma.businessWalletTransaction.create({
      data: {
        walletId: businessWallet.id,
        amount,
        type: "WITHDRAW",
        description: `Trả lương tháng ${record.month}/${record.year} cho ${record.staff.fullName}`,
      },
    }),
    // Cộng vào ví cá nhân của nhân viên
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
