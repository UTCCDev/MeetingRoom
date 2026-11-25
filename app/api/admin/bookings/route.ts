import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";

const PERSON = { select: { id: true, name: true, email: true, department: { select: { name: true } } } } as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 2000;

/**
 * Booking history for admins.
 * SYSTEM_ADMIN: every booking. ROOM_ADMIN: rooms they administer or approve for.
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (Bangkok days, by meeting start; default last 90 days to +1 year).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await loadActor((await getServerSession(authOptions)) as any);
    if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    if (actor.role === "USER") {
      return NextResponse.json({ error: "เฉพาะผู้ดูแลห้องหรือผู้ดูแลระบบ" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+07:00`) : null);
    const from = day(params.get("from")) ?? new Date(Date.now() - 90 * DAY_MS);
    const toDay = day(params.get("to"));
    const to = toDay ? new Date(toDay.getTime() + DAY_MS) : new Date(Date.now() + 366 * DAY_MS);

    const roomScope =
      actor.role === "SYSTEM_ADMIN"
        ? {}
        : { room: { OR: [{ roomAdminId: actor.id }, { approvers: { some: { id: actor.id } } }] } };

    const bookings = await prisma.booking.findMany({
      where: { ...roomScope, startTime: { gte: from, lt: to } },
      include: {
        room: { select: { id: true, code: true, name: true, description: true, capacity: true } },
        user: PERSON,
        bookedFor: PERSON,
        approvedBy: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { startTime: "desc" },
      take: MAX_ROWS,
    });

    return NextResponse.json({ bookings, truncated: bookings.length === MAX_ROWS });
  } catch (error) {
    console.error("Error loading booking history:", error);
    return NextResponse.json({ error: "โหลดประวัติการจองไม่สำเร็จ" }, { status: 500 });
  }
}
