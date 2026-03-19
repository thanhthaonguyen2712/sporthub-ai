import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");

    const today = new Date();
    const todayDate = new Date(today.toISOString().split("T")[0]);
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Lấy tất cả booking hôm nay
    const todayBookings = await prisma.booking.findMany({
      where: {
        bookingDate: todayDate,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        courtId: true,
        startTime: true,
        endTime: true,
      },
    });

    // Lấy tất cả facilities + courts
    const facilities = await prisma.facility.findMany({
      where: { isActive: true },
      include: {
        courts: {
          where: { isActive: true },
          include: { category: true },
        },
        facilitySports: {
          include: { sportCategory: true },
        },
      },
    });

    const result = facilities.map((f) => {
      // Tính khoảng cách nếu có vị trí
      let distance: number | null = null;
      if (lat && lng && f.latitude && f.longitude) {
        const R = 6371;
        const dLat = (Number(f.latitude) - lat) * Math.PI / 180;
        const dLon = (Number(f.longitude) - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(Number(f.latitude) * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }

      // Kiểm tra từng sân có trống không
      const availableCourts = f.courts.filter((court) => {
        const courtBookings = todayBookings.filter((b) => b.courtId === court.id);
        // Slot hiện tại (làm tròn 30p hoặc 1h)
        const isBooked = courtBookings.some((b) => {
          const startMin = b.startTime.getUTCHours() * 60 + b.startTime.getUTCMinutes();
          const endMin = b.endTime.getUTCHours() * 60 + b.endTime.getUTCMinutes();
          return currentTimeMinutes >= startMin && currentTimeMinutes < endMin;
        });
        return !isBooked;
      });

      return {
        id: f.id,
        name: f.name,
        address: f.address,
        distance,
        totalCourts: f.courts.length,
        availableCourts: availableCourts.length,
        sports: f.facilitySports.map((fs) => fs.sportCategory.name),
        availableSports: [...new Set(availableCourts.map((c) => c.category.name))],
      };
    })
    .filter((f) => f.availableCourts > 0) // chỉ lấy sân còn trống
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)); // sort theo khoảng cách

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}