import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, phone, fullName, password } = await req.json();

    // 1. Kiểm tra đủ thông tin không
    if (!email || !phone || !fullName || !password) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ thông tin" },
        { status: 400 }
      );
    }

    // 2. Kiểm tra email đã tồn tại chưa
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Email đã được sử dụng" },
        { status: 409 }
      );
    }

    // 3. Kiểm tra số điện thoại đã tồn tại chưa
    const existingPhone = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: "Số điện thoại đã được sử dụng" },
        { status: 409 }
      );
    }

    // 4. Mã hóa password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Tạo user + ví điện tử cùng lúc
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        fullName,
        password: hashedPassword,
        role: "CUSTOMER",
        wallet: {
          create: {
            balance: 0,
            status: "ACTIVE",
          },
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Đăng ký thành công!", user },
      { status: 201 }
    );

  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Lỗi server, vui lòng thử lại" },
      { status: 500 }
    );
  }
}