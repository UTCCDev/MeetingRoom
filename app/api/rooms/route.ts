import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomSchema } from "@/lib/room-schema";
import { firstError } from "@/lib/validation";

// GET active rooms (public). Includes upcoming booked time ranges only, so the
// search page can filter by availability without exposing booking details.
// ?all=1 also returns inactive rooms: every room for system admins, the
// caller's own rooms for room admins.
export async function GET(request: NextRequest) {
  try {
    let where: any = { status: true };

    if (request.nextUrl.searchParams.get("all") === "1") {
      const session = await getServerSession(authOptions);
      const user = session?.user as any;
      if (user?.role === "SYSTEM_ADMIN") where = {};
      else if (user?.role === "ROOM_ADMIN") where = { roomAdminId: user.id };
    }

    const rooms = await prisma.room.findMany({
      where,
      include: {
        roomAdmin: {
          select: { id: true, name: true, email: true },
        },
        bookings: {
          where: {
            status: { in: ["PENDING", "APPROVED"] },
            endTime: { gt: new Date() },
          },
          select: { startTime: true, endTime: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}

// POST create a new room
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;

    // Only SYSTEM_ADMIN can create rooms
    if (userRole !== "SYSTEM_ADMIN") {
      return NextResponse.json(
        { error: "\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e23\u0e30\u0e1a\u0e1a\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19\u0e17\u0e35\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16ส\u0e23้างห้อง" },
        { status: 403 }
      );
    }

    const parsed = roomSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const { name, description, capacity, image, amenities, roomAdminId, status } = parsed.data;

    // Verify room admin exists
    const roomAdmin = await prisma.user.findUnique({
      where: { id: roomAdminId },
    });

    if (!roomAdmin || roomAdmin.role === "USER") {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e2b\u0e49\u0e2d\u0e07" },
        { status: 404 }
      );
    }

    const room = await prisma.room.create({
      data: {
        name,
        description,
        capacity,
        image: image || null,
        amenities: amenities ?? undefined,
        roomAdminId,
        status: status ?? true,
      },
      include: {
        roomAdmin: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e41\u0e14\u0e01\u0e01\u0e25\u0e32\u0e07\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e2d\u0e2d\u0e23\u0e4c" },
      { status: 500 }
    );
  }
}
