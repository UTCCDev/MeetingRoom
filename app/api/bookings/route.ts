import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET all bookings for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15" },
        { status: 401 }
      );
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: (session.user as any).id,
      },
      include: {
        room: true,
      },
      orderBy: {
        startTime: "desc",
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e41\u0e14\u0e01\u0e01\u0e25\u0e32\u0e07\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e2d\u0e2d\u0e23\u0e4c" },
      { status: 500 }
    );
  }
}

// POST create a new booking
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15" },
        { status: 401 }
      );
    }

    const { roomId, title, description, attendees, startTime, endTime } =
      await request.json();

    if (!roomId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "\u0e2b\u0e32\u0e22\u0e44\u0e1b\u0e1a\u0e32\u0e07\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e35\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19" },
        { status: 400 }
      );
    }

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2b\u0e49\u0e2d\u0e07\u0e19\u0e35\u0e49" },
        { status: 404 }
      );
    }

    // Check for conflicts
    const existingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            startTime: { lte: new Date(endTime) },
            endTime: { gte: new Date(startTime) },
          },
        ],
      },
    });

    if (existingBooking) {
      return NextResponse.json(
          { error: "\u0e2b\u0e49\u0e2d\u0e07\u0e2b\u0e21\u0e14\u0e43\u0e08\u0e44\u0e01\u0e25\u0e19\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e0a\u0e48\u0e27\u0e07\u0e40\u0e27\u0e25\u0e32\u0e2b\u0e21\u0e31\u0e14\u0e19\u0e35\u0e49" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        userId: (session.user as any).id,
        roomId,
        title,
        description,
        attendees: attendees || 1,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "PENDING",
      },
      include: {
        room: true,
        user: true,
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e41\u0e14\u0e01\u0e01\u0e25\u0e32\u0e07\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e2d\u0e2d\u0e23\u0e4c" },
      { status: 500 }
    );
  }
}
