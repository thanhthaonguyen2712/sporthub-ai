import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Thiếu email" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Không tiết lộ email có tồn tại không
      return NextResponse.json({ success: true });
    }

    // Tài khoản nhân viên không được tự đặt lại mật khẩu
    if (user.role === "STAFF" || user.role === "WAREHOUSE_MANAGER") {
      return NextResponse.json({ error: "STAFF_ACCOUNT" }, { status: 403 });
    }

    // Tạo token reset
    const token = crypto.randomBytes(32).toString("hex");
    const exp = new Date(Date.now() + 30 * 60 * 1000); // hết hạn sau 30 phút

    await prisma.user.update({
      where: { email },
      data: { resetToken: token, resetTokenExp: exp },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    // Gửi email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"SportHub AI" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Đặt lại mật khẩu SportHub",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #10b981;">🏸 SportHub AI</h2>
          <p>Xin chào <b>${user.fullName}</b>,</p>
          <p>Bạn vừa yêu cầu đặt lại mật khẩu. Click vào nút bên dưới để tiếp tục:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
            Đặt lại mật khẩu
          </a>
          <p style="color: #666; font-size: 13px;">Link có hiệu lực trong <b>30 phút</b>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">SportHub AI - Nền tảng đặt sân thể thao thông minh</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}