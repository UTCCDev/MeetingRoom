import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET pending bookings for a room admin. Includes requests whose meeting
// already started; the page shows those separately as read-only.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    let bookings;

    if (userRole === "ROOM_ADMIN") {
      // Get pending bookings for rooms managed by this user
      bookings = await prisma.booking.findMany({
        where: {
          status: "PENDING",
          room: {
            roomAdminId: userId,
          },
        },
        include: {
          room: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: {
          startTime: "asc",
        },
      });
    } else if (userRole === "SYSTEM_ADMIN") {
      // System admin can see all pending bookings
      bookings = await prisma.booking.findMany({
        where: {
          status: "PENDING",
        },
        include: {
          room: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: {
          startTime: "asc",
        },
      });
    } else {
      return NextResponse.json(
        { error: "เฉพาะผู้ดูแลเท่านั้นที่เข้าถึงส่วนนี้ได้" },
        { status: 403 }
      );
    }

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
