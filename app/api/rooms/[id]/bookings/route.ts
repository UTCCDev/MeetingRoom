import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const bookings = await prisma.booking.findMany({
      where: {
        roomId: id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: {
        id: true,
        // Meeting subjects are only shared with signed-in users; anonymous
        // visitors just see the busy time range.
        title: !!session?.user,
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

