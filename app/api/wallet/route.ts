import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: Number((session.user as any).id) },
    });

    return NextResponse.json({
      balance: wallet ? Number(wallet.balance) : 0,
      status: wallet?.status || "ACTIVE",
    });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}