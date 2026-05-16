import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number((session.user as any).id);
  const accounts = await prisma.bankAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number((session.user as any).id);
  const { bankBin, bankLabel, accountNumber, accountName, isDefault } = await req.json();

  if (!bankBin || !accountNumber || !accountName) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }

  if (isDefault) {
    await prisma.bankAccount.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const account = await prisma.bankAccount.create({
    data: {
      userId,
      bankName: `${bankBin}|${bankLabel}`,
      accountNumber,
      accountName,
      isDefault: isDefault ?? false,
    },
  });
  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number((session.user as any).id);
  const { id } = await req.json();

  const account = await prisma.bankAccount.findUnique({ where: { id: Number(id) } });
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }
  await prisma.bankAccount.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
