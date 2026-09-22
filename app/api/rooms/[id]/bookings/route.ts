import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        roomId: params.id,
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
