import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TYPE_LABEL: Record<string, string> = {
  FACILITY: "Sự cố cơ sở / sân",
  EQUIPMENT: "Thiết bị hỏng hóc",
  INVENTORY_DAMAGE: "Hàng hóa hỏng",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staffId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { type, title, description } = await req.json();
  if (!type || !title || !description) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // Lấy thông tin cơ sở + chủ sân + warehouse managers
  const staffRecord = await prisma.facilityStaff.findFirst({
    where: { userId: staffId },
    include: { user: { select: { fullName: true } } },
  });
  if (!staffRecord) return NextResponse.json({ error: "Chưa được gắn vào cơ sở" }, { status: 403 });

  const facility = await prisma.facility.findUnique({
    where: { id: staffRecord.facilityId },
    include: {
      owner: { select: { id: true } },
      facilityStaff: {
        where: { role: "WAREHOUSE_MANAGER" },
        include: { user: { select: { id: true } } },
      },
    },
  });
  if (!facility) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  // Lưu báo cáo
  const report = await prisma.staffReport.create({
    data: { staffId, facilityId: staffRecord.facilityId, type, title, description },
  });

  const staffName = staffRecord.user.fullName;
  const notifTitle = `⚠️ Báo cáo: ${TYPE_LABEL[type] || type}`;
  const notifContent =
    `${staffName} báo cáo tại ${facility.name}: "${title}" — ` +
    `${description.substring(0, 100)}${description.length > 100 ? "..." : ""}`;

  const recipients = new Set<number>();
  recipients.add(facility.owner.id); // luôn thông báo chủ sân

  // Hàng hóa hỏng → thêm warehouse manager
  if (type === "INVENTORY_DAMAGE") {
    for (const sr of facility.facilityStaff) {
      if (sr.userId !== staffId) recipients.add(sr.user.id);
    }
  }

  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({
      userId,
      title: notifTitle,
      content: notifContent,
      type: "REPORT" as const,
    })),
  });

  return NextResponse.json({ success: true, reportId: report.id });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staffId = Number((session.user as any).id);
  const role = (session.user as any).role;
  if (role !== "STAFF" && role !== "WAREHOUSE_MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const reports = await prisma.staffReport.findMany({
    where: { staffId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(reports);
}
