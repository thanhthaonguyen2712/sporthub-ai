import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { id } = await params;
    const joinerId = Number((session.user as any).id);

    const post = await prisma.matchPost.findUnique({
      where: { id: Number(id) },
      include: { creator: { include: { wallet: true } } },
    });

    if (!post) return NextResponse.json({ error: "Không tìm thấy bài đăng" }, { status: 404 });
    if (post.status !== "OPEN") return NextResponse.json({ error: "Nhóm này đã đủ người hoặc hết hạn" }, { status: 400 });
    if (post.creatorId === joinerId) {
      return NextResponse.json({ error: "Bạn là người tạo nhóm này" }, { status: 400 });
    }

    const pricePerPerson = post.pricePerPerson ? Number(post.pricePerPerson) : 0;

    // Wallet payment if pricePerPerson > 0
    if (pricePerPerson > 0) {
      const joinerWallet = await prisma.wallet.findUnique({ where: { userId: joinerId } });
      if (!joinerWallet || Number(joinerWallet.balance) < pricePerPerson) {
        return NextResponse.json(
          { error: `Số dư ví không đủ! Cần ${pricePerPerson.toLocaleString("vi-VN")}đ để tham gia.` },
          { status: 400 }
        );
      }

      const creatorWallet = post.creator.wallet;
      if (!creatorWallet) {
        return NextResponse.json({ error: "Tài khoản người tạo chưa có ví" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // Deduct from joiner
        await tx.wallet.update({
          where: { userId: joinerId },
          data: { balance: { decrement: pricePerPerson } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: joinerWallet.id,
            amount: pricePerPerson,
            type: "PAYMENT",
            description: `Tham gia nhóm tìm đồng đội #${post.id} - ${post.title}`,
          },
        });

        // Credit creator
        await tx.wallet.update({
          where: { userId: post.creatorId },
          data: { balance: { increment: pricePerPerson } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: creatorWallet.id,
            amount: pricePerPerson,
            type: "REFUND",
            description: `Nhận tiền từ thành viên tham gia nhóm #${post.id}`,
          },
        });

        // Update post
        const newJoined = post.joinedPlayers + 1;
        const newStatus = newJoined >= post.requiredPlayers ? "CLOSED" : "OPEN";
        await tx.matchPost.update({
          where: { id: Number(id) },
          data: { joinedPlayers: newJoined, status: newStatus },
        });
      });
    } else {
      // Free join (no price)
      const newJoined = post.joinedPlayers + 1;
      const newStatus = newJoined >= post.requiredPlayers ? "CLOSED" : "OPEN";
      await prisma.matchPost.update({
        where: { id: Number(id) },
        data: { joinedPlayers: newJoined, status: newStatus },
      });
    }

    const updated = await prisma.matchPost.findUnique({ where: { id: Number(id) } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
