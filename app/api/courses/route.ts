import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Lấy danh sách khóa học
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "public" | "mine"
    const session = await getServerSession(authOptions);

    if (type === "mine") {
      if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      const enrollments = await prisma.courseEnrollment.findMany({
        where: { userId: Number((session.user as any).id) },
        include: {
          course: {
            include: {
              coach: { select: { fullName: true, phone: true, email: true } },
              facility: { select: { name: true, address: true } },
              _count: { select: { enrollments: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(enrollments);
    }

    // Public courses
    const courses = await prisma.course.findMany({
      where: { isPublic: true, isActive: true },
      include: {
        coach: { select: { fullName: true, phone: true, email: true } },
        facility: { select: { name: true, address: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// POST - Tạo khóa học mới
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const body = await req.json();
    const { title, description, sport, level, price, maxStudents, schedule, startDate, endDate, facilityId, isPublic } = body;

    if (!title || !sport || !level || !price || !schedule || !startDate || !endDate) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        sport,
        level,
        price: Number(price),
        maxStudents: Number(maxStudents) || 10,
        schedule,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        facilityId: facilityId ? Number(facilityId) : null,
        coachId: Number((session.user as any).id),
        isPublic: isPublic ?? true,
      },
    });

    return NextResponse.json({ success: true, course });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}