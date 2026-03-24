import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/** Wrap body content inside the shared SportHub email shell */
function wrapTemplate(body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
      <div style="background: #ffffff; border-radius: 10px; padding: 28px; border: 1px solid #e5e7eb;">
        <h2 style="color: #10b981; margin-top: 0;">🏸 SportHub AI</h2>
        ${body}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          SportHub AI — Nền tảng đặt sân thể thao thông minh.<br>
          Nếu bạn không thực hiện hành động này, vui lòng bỏ qua email này.
        </p>
      </div>
    </div>
  `;
}

/** Low-level send — fire and forget, never throws */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"SportHub AI" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: wrapTemplate(html),
    });
  } catch (err) {
    // Email failure must never break the main flow
    console.error("[email] Failed to send to", to, err);
  }
}

/**
 * Send an email to a user only if they have notifEmail enabled.
 * Fetches email + preference from DB.
 */
export async function sendUserEmail(
  userId: number,
  subject: string,
  html: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, notifEmail: true },
    });
    if (!user || !user.notifEmail) return;
    await sendEmail(user.email, subject, html);
  } catch (err) {
    console.error("[email] sendUserEmail error for userId", userId, err);
  }
}

// ─── Pre-built templates ──────────────────────────────────────────────────────

export function emailBookingConfirmed(
  fullName: string,
  bookingId: number,
  courtName: string,
  date: string,
  startTime: string,
  endTime: string,
  amount: number
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Lịch đặt sân của bạn đã được xác nhận thành công!</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Mã đặt sân</td><td><b>#${bookingId}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Sân</td><td><b>${courtName}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Ngày</td><td><b>${date}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Giờ</td><td><b>${startTime} – ${endTime}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Đã thanh toán</td><td style="color:#10b981;"><b>${amount.toLocaleString("vi-VN")}đ</b></td></tr>
    </table>
    <p style="color:#6b7280; font-size:13px;">Chúc bạn có buổi tập luyện vui vẻ! 🎉</p>
  `;
}

export function emailBookingCancelled(
  fullName: string,
  bookingId: number,
  refunded: boolean,
  refundAmount: number
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Lịch đặt sân <b>#${bookingId}</b> của bạn đã được hủy thành công.</p>
    ${refunded
      ? `<p style="color:#10b981;">✅ Số tiền <b>${refundAmount.toLocaleString("vi-VN")}đ</b> đã được hoàn về ví SportHub của bạn.</p>`
      : ""
    }
    <p style="color:#6b7280; font-size:13px;">Nếu bạn cần hỗ trợ, vui lòng liên hệ chúng tôi.</p>
  `;
}

export function emailWalletTopup(fullName: string, amount: number, newBalance: number): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Ví SportHub của bạn vừa được nạp tiền thành công!</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Số tiền nạp</td><td style="color:#10b981;"><b>+${amount.toLocaleString("vi-VN")}đ</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Số dư hiện tại</td><td><b>${newBalance.toLocaleString("vi-VN")}đ</b></td></tr>
    </table>
  `;
}

export function emailWalletWithdraw(
  fullName: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  newBalance: number
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Yêu cầu rút tiền của bạn đã được xử lý.</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Số tiền rút</td><td style="color:#ef4444;"><b>-${amount.toLocaleString("vi-VN")}đ</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Ngân hàng</td><td><b>${bankName}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Số tài khoản</td><td><b>${accountNumber}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Số dư còn lại</td><td><b>${newBalance.toLocaleString("vi-VN")}đ</b></td></tr>
    </table>
  `;
}

export function emailCourseEnrolled(
  fullName: string,
  courseTitle: string,
  schedule: string,
  startDate: string,
  endDate: string,
  price: number,
  nextPaymentDate: string
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Bạn đã đăng ký khóa học thành công!</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Khóa học</td><td><b>${courseTitle}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Lịch học</td><td><b>${schedule}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Bắt đầu</td><td><b>${startDate}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Kết thúc</td><td><b>${endDate}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Học phí tháng này</td><td style="color:#ef4444;"><b>${price.toLocaleString("vi-VN")}đ</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Kỳ thanh toán tiếp theo</td><td><b>${nextPaymentDate}</b></td></tr>
    </table>
  `;
}

export function emailMembershipUpgraded(
  fullName: string,
  tier: string,
  price: number,
  endDate: string
): string {
  const tierColors: Record<string, string> = {
    SILVER: "#94a3b8",
    GOLD: "#f59e0b",
    PLATINUM: "#8b5cf6",
  };
  const color = tierColors[tier] ?? "#10b981";
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Gói hội viên của bạn đã được nâng cấp thành công!</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Gói</td><td style="color:${color};"><b>${tier}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Phí</td><td style="color:#ef4444;"><b>${price.toLocaleString("vi-VN")}đ</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Hiệu lực đến</td><td><b>${endDate}</b></td></tr>
    </table>
  `;
}

export function emailCoursePaymentReminder(
  fullName: string,
  courseTitle: string,
  price: number,
  dueDate: string,
  isInsufficient: boolean,
  balance: number
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Nhắc nhở: Học phí tháng tới của khóa học <b>${courseTitle}</b> sắp đến hạn.</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Học phí</td><td><b>${price.toLocaleString("vi-VN")}đ</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Ngày thu</td><td><b>${dueDate}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Số dư ví</td><td style="color:${isInsufficient ? "#ef4444" : "#10b981"};"><b>${balance.toLocaleString("vi-VN")}đ</b></td></tr>
    </table>
    ${isInsufficient
      ? `<p style="color:#ef4444;"><b>⚠️ Số dư ví không đủ!</b> Vui lòng nạp thêm tiền trước ngày ${dueDate} để không bị gián đoạn khóa học.</p>`
      : `<p style="color:#10b981;">✅ Số dư ví của bạn đủ. Học phí sẽ được tự động trừ vào ngày ${dueDate}.</p>`
    }
  `;
}

export function emailMembershipReminder(
  fullName: string,
  tier: string,
  price: number,
  endDate: string,
  isInsufficient: boolean,
  balance: number
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p>Gói hội viên <b>${tier}</b> của bạn sắp hết hạn.</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b7280;">Gói</td><td><b>${tier}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Phí gia hạn</td><td><b>${price.toLocaleString("vi-VN")}đ</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Hết hạn</td><td><b>${endDate}</b></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Số dư ví</td><td style="color:${isInsufficient ? "#ef4444" : "#10b981"};"><b>${balance.toLocaleString("vi-VN")}đ</b></td></tr>
    </table>
    ${isInsufficient
      ? `<p style="color:#ef4444;"><b>⚠️ Số dư ví không đủ để gia hạn tự động!</b> Nạp thêm trước ngày ${endDate} để không bị hạ cấp về FREE.</p>`
      : `<p style="color:#10b981;">✅ Gói của bạn sẽ được tự động gia hạn vào ngày ${endDate}.</p>`
    }
  `;
}

export function emailAdminBroadcast(
  fullName: string,
  title: string,
  content: string
): string {
  return `
    <p>Xin chào <b>${fullName}</b>,</p>
    <p><b>${title}</b></p>
    <p style="background:#f3f4f6; padding:12px; border-radius:8px; color:#374151;">${content}</p>
  `;
}
