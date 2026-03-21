import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/owner/courts - Thêm sân con vào cơ sở
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const { facilityId, name, categoryId, weekdayPrice, weekendPrice, peakPrice } = await req.json();

  const facility = await prisma.facility.findFirst({ where: { id: Number(facilityId), ownerId } });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  const court = await prisma.court.create({
    data: {
      name,
      facilityId: Number(facilityId),
      categoryId: Number(categoryId),
      pricingRules: {
        create: [
          {
            dayType: "WEEKDAY",
            startTime: new Date("1970-01-01T00:00:00.000Z"),
            endTime: new Date("1970-01-01T17:00:00.000Z"),
            pricePerHour: Number(weekdayPrice),
          },
          {
            dayType: "WEEKEND",
            startTime: new Date("1970-01-01T00:00:00.000Z"),
            endTime: new Date("1970-01-01T17:00:00.000Z"),
            pricePerHour: Number(weekendPrice),
          },
          {
            dayType: "WEEKDAY",
            startTime: new Date("1970-01-01T17:00:00.000Z"),
            endTime: new Date("1970-01-01T21:00:00.000Z"),
            pricePerHour: Number(peakPrice),
            priority: 1,
          },
          {
            dayType: "WEEKEND",
            startTime: new Date("1970-01-01T17:00:00.000Z"),
            endTime: new Date("1970-01-01T21:00:00.000Z"),
            pricePerHour: Number(peakPrice),
            priority: 1,
          },
        ],
      },
    },
  });

  return NextResponse.json({ success: true, courtId: court.id });
}
