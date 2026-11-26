import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 20000;
const NO_DEPARTMENT = "ไม่ระบุหน่วยงาน";

/**
 * Room usage by department for admins (approved bookings only).
 * SYSTEM_ADMIN: every room. ROOM_ADMIN: rooms they administer or approve for.
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (Bangkok days, by meeting start; default last 30 days).
 * A booking counts for the department it was made for, else the booker's own department.
 * Returns one row per room + department.
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
    const from = day(params.get("from")) ?? new Date(Date.now() - 30 * DAY_MS);
    const toDay = day(params.get("to"));
    const to = toDay ? new Date(toDay.getTime() + DAY_MS) : new Date(Date.now() + DAY_MS);

    const roomScope =
      actor.role === "SYSTEM_ADMIN"
        ? {}
        : { room: { OR: [{ roomAdminId: actor.id }, { approvers: { some: { id: actor.id } } }] } };

    const bookings = await prisma.booking.findMany({
      where: { ...roomScope, status: "APPROVED", startTime: { gte: from, lt: to } },
      select: {
        startTime: true,
        endTime: true,
        attendees: true,
        room: { select: { id: true, code: true, name: true, description: true } },
        department: { select: { id: true, name: true } },
        user: { select: { department: { select: { id: true, name: true } } } },
      },
      take: MAX_ROWS,
    });

    const rows = new Map<
      string,
      {
        roomId: string;
        roomCode: string | null;
        roomName: string;
        roomDescription: string | null;
        departmentId: string | null;
        departmentName: string;
        bookings: number;
        minutes: number;
        attendees: number;
      }
    >();

    for (const b of bookings) {
      const dept = b.department ?? b.user.department;
      const key = `${b.room.id}|${dept?.id ?? ""}`;
      const row = rows.get(key) ?? {
        roomId: b.room.id,
        roomCode: b.room.code,
        roomName: b.room.name,
        roomDescription: b.room.description,
        departmentId: dept?.id ?? null,
        departmentName: dept?.name ?? NO_DEPARTMENT,
        bookings: 0,
        minutes: 0,
        attendees: 0,
      };
      row.bookings += 1;
      row.minutes += Math.max(0, Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000));
      row.attendees += b.attendees;
      rows.set(key, row);
    }

    return NextResponse.json({ rows: [...rows.values()], truncated: bookings.length === MAX_ROWS });
  } catch (error) {
    console.error("Error loading usage report:", error);
    return NextResponse.json({ error: "โหลดรายงานไม่สำเร็จ" }, { status: 500 });
  }
}
