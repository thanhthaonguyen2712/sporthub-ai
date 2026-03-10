import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/facilities?sport=bong-da&search=hoa-xuan
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport");     // filter theo môn
    const search = searchParams.get("search");   // tìm theo tên/địa chỉ

    const facilities = await prisma.facility.findMany({
      where: {
        isActive: true,
        // Filter theo môn thể thao
        ...(sport && {
          facilitySports: {
            some: {
              sportCategory: { slug: sport },
            },
          },
        }),
        // Tìm kiếm theo tên hoặc địa chỉ
        ...(search && {
          OR: [
            { name: { contains: search } },
            { address: { contains: search } },
          ],
        }),
      },
      include: {
        facilitySports: {
          include: { sportCategory: true },
        },
        courts: {
          where: { isActive: true },
          select: { id: true },
        },
        reviews: {
          select: { rating: true },
        },
        _count: {
          select: { courts: true },
        },
      },
      orderBy: { id: "desc" },
    });

    // Tính rating trung bình
    const result = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      address: f.address,
      description: f.description,
      latitude: f.latitude,
      longitude: f.longitude,
      sports: f.facilitySports.map((fs) => ({
        id: fs.sportCategory.id,
        name: fs.sportCategory.name,
        slug: fs.sportCategory.slug,
        icon: fs.sportCategory.iconUrl,
      })),
      courtCount: f._count.courts,
      avgRating:
        f.reviews.length > 0
          ? (
              f.reviews.reduce((sum, r) => sum + r.rating, 0) /
              f.reviews.length
            ).toFixed(1)
          : null,
      reviewCount: f.reviews.length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Lỗi server" },
      { status: 500 }
    );
  }
}