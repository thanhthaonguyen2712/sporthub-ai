import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: duyệt hoặc từ chối yêu cầu (chỉ người tạo bài)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id, requestId } = await params;
  const creatorId = Number((session.user as any).id);

  const post = await (prisma as any).matchPost.findUnique({
    where: { id: Number(id) },
    include: {
      facility: { select: { name: true, address: true } },
      category: { select: { name: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Không tìm thấy bài đăng" }, { status: 404 });
  if (post.creatorId !== creatorId) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const joinRequest = await (prisma as any).matchJoinRequest.findUnique({
    where: { id: Number(requestId) },
    include: {
      user: { select: { id: true, fullName: true, email: true, notifEmail: true } },
    },
  });
  if (!joinRequest) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
  if (joinRequest.matchPostId !== Number(id)) return NextResponse.json({ error: "Không hợp lệ" }, { status: 400 });
  if (joinRequest.status !== "PENDING") return NextResponse.json({ error: "Yêu cầu đã được xử lý" }, { status: 400 });

  const { action, note } = await req.json(); // action: "approve" (duyệt) | "reject" (từ chối)
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  }

  const matchDateStr = new Date(post.matchDate).toLocaleDateString("vi-VN");
  const startTime = post.startTime.toISOString().slice(11, 16);
  const endTime = post.endTime.toISOString().slice(11, 16);

  if (action === "reject") {
    await (prisma as any).matchJoinRequest.update({
      where: { id: Number(requestId) },
      data: { status: "REJECTED", note: note || null },
    });

    // Thông báo cho người xin tham gia (user đã đăng nhập)
    if (joinRequest.userId) {
      prisma.notification.create({
        data: {
          userId: joinRequest.userId,
          title: "Yêu cầu ghép trận bị từ chối",
          content: `Yêu cầu tham gia bài đăng "${post.title}" ngày ${matchDateStr} đã bị từ chối.${note ? ` Lý do: ${note}` : ""}`,
          type: "BOOKING",
          link: "/match-posts",
        },
      }).catch(() => {});

      if (joinRequest.user?.notifEmail && joinRequest.user?.email) {
        const { sendEmail } = await import("@/lib/email");
        sendEmail(
          joinRequest.user.email,
          `[SportHub] Yêu cầu ghép trận bị từ chối`,
          `<p>Xin chào <b>${joinRequest.user.fullName}</b>,</p>
           <p>Rất tiếc, yêu cầu tham gia ghép trận <b>"${post.title}"</b> ngày <b>${matchDateStr}</b> (${startTime}–${endTime}) tại <b>${post.facility.name}</b> đã bị từ chối.</p>
           ${note ? `<p style="color:#6b7280;">Lý do: ${note}</p>` : ""}
           <p style="color:#6b7280; font-size:13px;">Nếu bạn đã chuyển khoản, vui lòng liên hệ người đăng bài để được hoàn tiền.</p>`
        ).catch(() => {});
      }
    } else if (joinRequest.guestEmail) {
      // Gửi email cho khách vãng lai bị từ chối
      const { sendEmail } = await import("@/lib/email");
      sendEmail(
        joinRequest.guestEmail,
        `[SportHub] Yêu cầu ghép trận bị từ chối`,
        `<p>Xin chào <b>${joinRequest.guestName}</b>,</p>
         <p>Rất tiếc, yêu cầu tham gia ghép trận <b>"${post.title}"</b> ngày <b>${matchDateStr}</b> (${startTime}–${endTime}) tại <b>${post.facility.name}</b> đã bị từ chối.</p>
         ${note ? `<p style="color:#6b7280;">Lý do: ${note}</p>` : ""}
         <p style="color:#6b7280; font-size:13px;">Nếu bạn đã chuyển khoản, vui lòng liên hệ người đăng bài để được hoàn tiền.</p>`
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  // Xử lý trường hợp duyệt yêu cầu
  if (post.joinedPlayers >= post.requiredPlayers) {
    return NextResponse.json({ error: "Nhóm đã đủ người" }, { status: 400 });
  }

  const newJoined = post.joinedPlayers + 1;
  const isFull = newJoined >= post.requiredPlayers;

  await (prisma as any).$transaction(async (tx: any) => {
    // Cập nhật trạng thái yêu cầu tham gia
    await tx.matchJoinRequest.update({
      where: { id: Number(requestId) },
      data: { status: "APPROVED" },
    });

    // Cập nhật số người đã tham gia và trạng thái bài đăng
    await tx.matchPost.update({
      where: { id: Number(id) },
      data: {
        joinedPlayers: newJoined,
        status: isFull ? "CLOSED" : "OPEN",
      },
    });

    // Nếu là khách vãng lai được duyệt: tạo GuestBooking để họ tra cứu bằng SĐT
    if (!joinRequest.userId && joinRequest.guestPhone) {
      const court = await tx.court.findFirst({
        where: {
          facilityId: post.facilityId,
          category: { name: post.category.name },
          isActive: true,
        },
      });

      if (court) {
        await tx.guestBooking.create({
          data: {
            guestName: joinRequest.guestName || "Khách",
            guestPhone: joinRequest.guestPhone,
            guestEmail: joinRequest.guestEmail || undefined,
            courtId: court.id,
            bookingDate: post.matchDate,
            startTime: post.startTime,
            endTime: post.endTime,
            totalPrice: post.pricePerPerson ?? 0,
            status: "CONFIRMED",
            expiredAt: new Date(new Date(post.matchDate).getTime() + 24 * 60 * 60 * 1000),
            paymentQr: null,
          },
        });
      }
    }
  });

  // Thông báo và gửi email cho người được duyệt
  const requesterName = joinRequest.userId ? joinRequest.user?.fullName : joinRequest.guestName;

  if (joinRequest.userId) {
    prisma.notification.create({
      data: {
        userId: joinRequest.userId,
        title: "Yêu cầu ghép trận được duyệt! 🎉",
        content: `Yêu cầu tham gia "${post.title}" ngày ${matchDateStr} (${startTime}–${endTime}) tại ${post.facility.name} đã được chấp nhận!`,
        type: "BOOKING",
        link: "/profile?tab=matchjoins",
      },
    }).catch(() => {});

    if (joinRequest.user?.notifEmail && joinRequest.user?.email) {
      const { sendEmail } = await import("@/lib/email");
      sendEmail(
        joinRequest.user.email,
        `[SportHub] Yêu cầu ghép trận được duyệt! 🎉`,
        `<p>Xin chào <b>${joinRequest.user.fullName}</b>,</p>
         <p>🎉 Yêu cầu tham gia ghép trận <b>"${post.title}"</b> đã được chấp nhận!</p>
         <table style="width:100%; border-collapse:collapse; margin:16px 0;">
           <tr><td style="padding:6px 0; color:#6b7280;">Cơ sở</td><td><b>${post.facility.name}</b></td></tr>
           <tr><td style="padding:6px 0; color:#6b7280;">Địa chỉ</td><td>${post.facility.address}</td></tr>
           <tr><td style="padding:6px 0; color:#6b7280;">Ngày</td><td><b>${matchDateStr}</b></td></tr>
           <tr><td style="padding:6px 0; color:#6b7280;">Giờ</td><td><b>${startTime} – ${endTime}</b></td></tr>
           <tr><td style="padding:6px 0; color:#6b7280;">Môn</td><td>${post.category.name}</td></tr>
         </table>
         <p style="color:#10b981;">✅ Chúc bạn có buổi tập luyện vui vẻ!</p>`
      ).catch(() => {});
    }
  } else if (joinRequest.guestEmail) {
    const { sendEmail } = await import("@/lib/email");
    sendEmail(
      joinRequest.guestEmail,
      `[SportHub] Yêu cầu ghép trận được duyệt! 🎉`,
      `<p>Xin chào <b>${requesterName}</b>,</p>
       <p>🎉 Yêu cầu tham gia ghép trận <b>"${post.title}"</b> đã được chấp nhận!</p>
       <table style="width:100%; border-collapse:collapse; margin:16px 0;">
         <tr><td style="padding:6px 0; color:#6b7280;">Cơ sở</td><td><b>${post.facility.name}</b></td></tr>
         <tr><td style="padding:6px 0; color:#6b7280;">Địa chỉ</td><td>${post.facility.address}</td></tr>
         <tr><td style="padding:6px 0; color:#6b7280;">Ngày</td><td><b>${matchDateStr}</b></td></tr>
         <tr><td style="padding:6px 0; color:#6b7280;">Giờ</td><td><b>${startTime} – ${endTime}</b></td></tr>
       </table>
       <p style="color:#10b981;">✅ Chúc bạn có buổi tập luyện vui vẻ!</p>
       <p style="color:#6b7280; font-size:12px;">Bạn có thể tra cứu thông tin tại trang <b>Tra cứu đặt sân</b> bằng số điện thoại ${joinRequest.guestPhone}.</p>`
    ).catch(() => {});
  }

  // Thông báo cho người tạo bài về việc duyệt thành viên
  prisma.notification.create({
    data: {
      userId: creatorId,
      title: "Đã duyệt thành viên ghép trận",
      content: `Bạn đã duyệt ${requesterName} vào nhóm "${post.title}". ${isFull ? "Nhóm đã đủ người!" : `Còn ${post.requiredPlayers - newJoined} chỗ trống.`}`,
      type: "BOOKING",
      link: `/match-posts`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, status: "APPROVED", isFull });
}
