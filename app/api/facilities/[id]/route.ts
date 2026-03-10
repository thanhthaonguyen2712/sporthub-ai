import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const facility = await prisma.facility.findUnique({
      where: { id: Number(id) },
      include: {
        facilitySports: {
          include: { sportCategory: true },
        },
        courts: {
          where: { isActive: true },
          include: {
            category: true,
            pricingRules: true,
          },
        },
        services: {
          where: { isActive: true },
        },
        reviews: {
          include: {
            customer: {
              select: { fullName: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        owner: {
          select: { fullName: true, phone: true },
        },
      },
    });

    if (!facility) {
      return NextResponse.json({ error: "Không tìm thấy sân" }, { status: 404 });
    }

    const avgRating =
      facility.reviews.length > 0
        ? (
            facility.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
            facility.reviews.length
          ).toFixed(1)
        : null;

    return NextResponse.json({
      ...facility,
      avgRating,
      sports: facility.facilitySports.map((fs) => fs.sportCategory),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}