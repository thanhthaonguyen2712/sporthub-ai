import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Lấy cơ sở đầu tiên nhân viên thuộc về
  const facilityStaff = await prisma.facilityStaff.findFirst({
    where: { userId },
    include: { facility: { select: { id: true, name: true, address: true } } },
  });

  // Điểm danh hôm nay — dùng midnight UTC theo giờ VN (UTC+7)
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
  const todayUTC = new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()));
  const attendance = await prisma.staffAttendance.findFirst({
    where: {
      staffId: userId,
      date: { gte: todayUTC, lt: new Date(todayUTC.getTime() + 86400000) },
    },
  });

  // Ví
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true },
  });

  return NextResponse.json({
    facilityStaff,
    attendance,
    walletBalance: wallet?.balance ?? 0,
  });
}
