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
        { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าถึงส่วนนี้ได้" },
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

    // Get room utilization (Prisma 3.x doesn't support filtered relation
    // counts via _count.select.bookings.where, so aggregate manually)
    const [rooms, approvedCountsByRoom] = await Promise.all([
      prisma.room.findMany({ select: { id: true, name: true, description: true } }),
      prisma.booking.groupBy({
        by: ["roomId"],
        where: { status: "APPROVED" },
        _count: { id: true },
      }),
    ]);

    const approvedCountMap = new Map(
      approvedCountsByRoom.map((row) => [row.roomId, row._count.id])
    );

    // Counts approved bookings only; most-used rooms first.
    const roomUtilization = rooms
      .map((room) => ({
        roomId: room.id,
        roomName: room.name,
        roomDescription: room.description,
        bookingCount: approvedCountMap.get(room.id) || 0,
      }))
      .sort((a, b) => b.bookingCount - a.bookingCount);

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
      roomUtilization,
      bookingsByStatus: Object.fromEntries(
        bookingsByStatus.map((bs) => [bs.status, bs._count.id])
      ),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error(
      "Error fetching dashboard stats:",
      error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : error
    );
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
