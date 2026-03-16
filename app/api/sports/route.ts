import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sports
export async function GET() {
  try {
    const sports = await prisma.sportCategory.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(sports);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}