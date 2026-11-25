import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bangkokISO } from "@/lib/format";
import { roomPlace } from "@/lib/room-code";

// Name only: the page is open without login (housekeeping staff have no accounts), so no emails.
const USER_PUBLIC = { select: { id: true, name: true } } as const;

/**
 * GET /api/schedule?date=YYYY-MM-DD
 * Active rooms that have PENDING/APPROVED bookings that day, with building/floor,
 * for housekeeping staff checking rooms are used as booked. Open without login.
 */
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    }
    const dayStart = new Date(bangkokISO(date, "00:00"));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const rooms = await prisma.room.findMany({
      where: { status: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        capacity: true,
        bookings: {
          where: { status: { in: ["PENDING", "APPROVED"] }, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            status: true,
            attendees: true,
            user: USER_PUBLIC,
            bookedFor: USER_PUBLIC,
            department: { select: { name: true } },
          },
          orderBy: { startTime: "asc" },
        },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });

    const withPlace = rooms.map((r) => ({ ...r, ...roomPlace(r) }));
    // Filters list every building/floor of active rooms, even on a day they have no bookings.
    const places = [...new Map(withPlace.map((r) => [`${r.building}|${r.floor}`, { building: r.building, floor: r.floor }])).values()];
    // Only rooms with bookings that day; empty rooms are noise for the walk-round.
    return NextResponse.json({ places, rooms: withPlace.filter((r) => r.bookings.length > 0) });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" }, { status: 500 });
  }
}
