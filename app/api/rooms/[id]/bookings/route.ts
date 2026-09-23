import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookings = await prisma.booking.findMany({
      where: {
        roomId: id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        status: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching room bookings:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
