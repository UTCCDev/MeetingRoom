import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    if (userRole !== "SYSTEM_ADMIN") {
      return NextResponse.json(
        { error: "Only system admins can access this endpoint" },
        { status: 403 }
      );
    }

    // Get total stats
    const [totalRooms, totalUsers, totalBookings, pendingBookings, approvedBookings] = 
      await Promise.all([
        prisma.room.count(),
        prisma.user.count(),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: "PENDING" } }),
        prisma.booking.count({ where: { status: "APPROVED" } }),
      ]);

    // Get room utilization
    const roomUtilization = await prisma.room.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            bookings: {
              where: { status: "APPROVED" },
            },
          },
        },
      },
    });

    // Get booking status breakdown
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const stats = {
      totalRooms,
      totalUsers,
      totalBookings,
      pendingBookings,
      approvedBookings,
      roomUtilization: roomUtilization.map((room) => ({
        roomId: room.id,
        roomName: room.name,
        bookingCount: room._count.bookings,
      })),
      bookingsByStatus: Object.fromEntries(
        bookingsByStatus.map((bs) => [bs.status, bs._count.id])
      ),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
