import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";

// GET active catalog items, optionally for one department
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const dept = new URL(request.url).searchParams.get("dept");
    if (dept && dept !== "AV" && dept !== "HOUSEKEEPING") {
      return NextResponse.json({ error: "แผนกไม่ถูกต้อง" }, { status: 400 });
    }

    const items = await prisma.serviceCatalogItem.findMany({
      where: { active: true, ...(dept ? { department: dept as "AV" | "HOUSEKEEPING" } : {}) },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching service catalog:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
