import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: danh sách bài đăng tìm đồng đội
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "OPEN") as "OPEN" | "CLOSED" | "EXPIRED";
    const facilityIdParam = searchParams.get("facilityId");

    // Tự động hết hạn các bài đăng đã qua ngày thi đấu (giờ Việt Nam UTC+7)
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayDateStr = nowVN.toISOString().split("T")[0];
    const currentTimeStr = nowVN.toISOString().slice(11, 16);

    // Hết hạn các bài đăng có ngày thi đấu trước hôm nay
    await prisma.matchPost.updateMany({
      where: {
        status: "OPEN",
        matchDate: { lt: new Date(todayDateStr + "T00:00:00.000Z") },
      },
      data: { status: "EXPIRED" },
    });

    // Hết hạn các bài đăng hôm nay đã quá giờ kết thúc
    const currentEndTime = new Date(`1970-01-01T${currentTimeStr}:00.000Z`);
    await prisma.matchPost.updateMany({
      where: {
        status: "OPEN",
        matchDate: new Date(todayDateStr + "T00:00:00.000Z"),
        endTime: { lt: currentEndTime },
      },
      data: { status: "EXPIRED" },
    });

    const where: Record<string, unknown> = { status };
    if (facilityIdParam) where.facilityId = Number(facilityIdParam);

    const posts = await prisma.matchPost.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, address: true } },
        category: { select: { id: true, name: true, iconUrl: true } },
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: [{ matchDate: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(
      posts.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        matchDate: p.matchDate,
        startTime: p.startTime.toISOString().slice(11, 16),
        endTime: p.endTime.toISOString().slice(11, 16),
        level: p.level,
        status: p.status,
        requiredPlayers: p.requiredPlayers,
        joinedPlayers: p.joinedPlayers,
        remaining: p.requiredPlayers - p.joinedPlayers,
        facility: p.facility,
        sport: p.category,
        creator: p.creator,
        createdAt: p.createdAt,
        courtName: p.courtName ?? null,
        pricePerPerson: p.pricePerPerson ? Number(p.pricePerPerson) : null,
        totalPrice: p.totalPrice ? Number(p.totalPrice) : null,
        qrCodeUrl: p.qrCodeUrl ?? null,
        isLocked: p.isLocked ?? false,
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// POST: tạo bài đăng tìm đồng đội mới
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const {
      title,
      description,
      matchDate,
      startTime,
      endTime,
      level,
      requiredPlayers,
      facilityId,
      categoryId,
      bookingId,
      courtId,
      courtName,
      totalPrice,
    } = await req.json();

    if (!matchDate || !startTime || !endTime || !level || !requiredPlayers || !facilityId || !categoryId) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const creatorId = Number((session.user as any).id);

    const startTimeDate = new Date(`1970-01-01T${startTime}:00.000Z`);
    const endTimeDate = new Date(`1970-01-01T${endTime}:00.000Z`);

    const sport = await prisma.sportCategory.findUnique({ where: { id: Number(categoryId) }, select: { name: true } });
    const autoTitle = title?.trim() || `Tìm ${Number(requiredPlayers) - 1} người chơi ${sport?.name || ""}`;

    const numRequired = Number(requiredPlayers);
    const numTotal = totalPrice ? Number(totalPrice) : null;
    const pricePerPerson = numTotal && numRequired > 1 ? Math.ceil(numTotal / numRequired) : null;

    // Nếu không có bookingId nhưng có courtId → tạo booking thật và trừ ví
    if (!bookingId && courtId) {
      if (!numTotal) {
        return NextResponse.json({ error: "Cần cung cấp tổng tiền để tạo lịch đặt" }, { status: 400 });
      }

      const courtIdNum = Number(courtId);

      // Kiểm tra trùng lịch
      const conflict = await prisma.booking.findFirst({
        where: {
          courtId: courtIdNum,
          bookingDate: new Date(matchDate),
          status: { notIn: ["CANCELLED"] },
          OR: [{ startTime: { lte: endTimeDate }, endTime: { gte: startTimeDate } }],
        },
      });
      if (conflict) {
        return NextResponse.json({ error: "Khung giờ này đã được đặt!" }, { status: 409 });
      }

      // Kiểm tra ví
      const wallet = await prisma.wallet.findUnique({ where: { userId: creatorId } });
      if (!wallet || Number(wallet.balance) < numTotal) {
        return NextResponse.json({ error: "Số dư ví không đủ!" }, { status: 400 });
      }

      const walletId = wallet.id;

      const post = await prisma.$transaction(async (tx) => {
        // Tạo booking
        const booking = await tx.booking.create({
          data: {
            courtId: courtIdNum,
            customerId: creatorId,
            bookingDate: new Date(matchDate),
            startTime: startTimeDate,
            endTime: endTimeDate,
            totalPrice: numTotal,
            status: "CONFIRMED",
            paymentStatus: "PAID",
          },
        });

        // Tạo invoice (để xuất hiện trong lịch đặt sân)
        await tx.invoice.create({
          data: {
            bookingId: booking.id,
            subTotal: numTotal,
            discountAmount: 0,
            finalTotal: numTotal,
            paymentMethod: "WALLET",
          },
        });

        // Trừ ví
        await tx.wallet.update({
          where: { userId: creatorId },
          data: { balance: { decrement: numTotal } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId,
            amount: numTotal,
            type: "PAYMENT",
            description: `Đặt sân tìm đồng đội - ${autoTitle}`,
          },
        });

        // Tạo match post
        const newPost = await tx.matchPost.create({
          data: {
            title: autoTitle,
            description: description?.trim() || null,
            matchDate: new Date(matchDate),
            startTime: startTimeDate,
            endTime: endTimeDate,
            level,
            requiredPlayers: numRequired,
            joinedPlayers: 1,
            creatorId,
            facilityId: Number(facilityId),
            categoryId: Number(categoryId),
            bookingId: booking.id,
            ...(courtName ? { courtName: String(courtName) } : {}),
            totalPrice: numTotal,
            ...(pricePerPerson ? { pricePerPerson } : {}),
          },
          include: {
            facility: { select: { id: true, name: true, address: true } },
            category: { select: { id: true, name: true, iconUrl: true } },
            creator: { select: { id: true, fullName: true } },
          },
        });

        return newPost;
      });

      const walletAfter = Number(wallet.balance) - numTotal;
      const matchDateStr = new Date(matchDate).toLocaleDateString("vi-VN");

      // Thông báo 1: Đặt sân thành công (BOOKING)
      prisma.notification.create({
        data: {
          userId: creatorId,
          title: "Đặt sân tìm đồng đội thành công",
          content: `Sân ${courtName ?? ""} ngày ${matchDateStr} lúc ${startTime}–${endTime}. Mã booking #${(post as any).bookingId}.`,
          type: "BOOKING",
          link: "/profile?tab=bookings",
        },
      }).catch(() => {});

      // Thông báo 2: Ví bị trừ tiền (PAYMENT)
      prisma.notification.create({
        data: {
          userId: creatorId,
          title: "Ví SportHub bị trừ tiền",
          content: `Đã trừ ${numTotal.toLocaleString("vi-VN")}đ cho đặt sân tìm đồng đội. Số dư còn lại: ${walletAfter.toLocaleString("vi-VN")}đ.`,
          type: "PAYMENT",
          link: "/profile?tab=wallet",
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          ...post,
          startTime: post.startTime.toISOString().slice(11, 16),
          endTime: post.endTime.toISOString().slice(11, 16),
          sport: post.category,
          remaining: post.requiredPlayers - post.joinedPlayers,
          pricePerPerson: post.pricePerPerson ? Number(post.pricePerPerson) : null,
          totalPrice: post.totalPrice ? Number(post.totalPrice) : null,
        },
        { status: 201 }
      );
    }

    // Trường hợp đã có bookingId (từ trang booking-success)
    const post = await prisma.matchPost.create({
      data: {
        title: autoTitle,
        description: description?.trim() || null,
        matchDate: new Date(matchDate),
        startTime: startTimeDate,
        endTime: endTimeDate,
        level,
        requiredPlayers: numRequired,
        joinedPlayers: 1,
        creatorId,
        facilityId: Number(facilityId),
        categoryId: Number(categoryId),
        ...(bookingId ? { bookingId: Number(bookingId) } : {}),
        ...(courtName ? { courtName: String(courtName) } : {}),
        ...(numTotal ? { totalPrice: numTotal } : {}),
        ...(pricePerPerson ? { pricePerPerson } : {}),
      },
      include: {
        facility: { select: { id: true, name: true, address: true } },
        category: { select: { id: true, name: true, iconUrl: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json(
      {
        ...post,
        startTime: post.startTime.toISOString().slice(11, 16),
        endTime: post.endTime.toISOString().slice(11, 16),
        sport: post.category,
        remaining: post.requiredPlayers - post.joinedPlayers,
        pricePerPerson: post.pricePerPerson ? Number(post.pricePerPerson) : null,
        totalPrice: post.totalPrice ? Number(post.totalPrice) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
