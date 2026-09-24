import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationItem, NotificationType } from "@/lib/notifications";

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 30;
const LIMIT = 40;

const ROOM = { select: { id: true, name: true, description: true, capacity: true } } as const;
const REQUESTER = { select: { name: true, email: true } } as const;

type Row = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: number;
  updatedAt: Date;
  createdAt: Date;
  rejectionReason: string | null;
  room: { id: string; name: string; description: string | null; capacity: number };
  user?: { name: string; email: string };
};

function item(type: NotificationType, at: Date, b: Row): NotificationItem {
  return {
    id: `${type}:${b.id}`,
    type,
    at: at.toISOString(),
    bookingId: b.id,
    title: b.title,
    roomId: b.room.id,
    roomName: b.room.name,
    roomDescription: b.room.description,
    capacity: b.room.capacity,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    attendees: b.attendees,
    requester: b.user,
    reason: type === "rejected" ? b.rejectionReason : undefined,
  };
}

/**
 * Notifications are derived from bookings (no separate table):
 *  - approvers: pending requests they can decide, and cancellations in their rooms
 *  - everyone: decisions on their own requests, and approved meetings starting within 24 h
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const me = (session.user as any).id as string;
    const role = (session.user as any).role as string;
    const now = new Date();
    const since = new Date(now.getTime() - HISTORY_DAYS * DAY);
    const items: NotificationItem[] = [];

    if (role === "ROOM_ADMIN" || role === "SYSTEM_ADMIN") {
      // System admins see every room; room admins only their own.
      const scope = role === "ROOM_ADMIN" ? { room: { roomAdminId: me } } : {};

      const pending = await prisma.booking.findMany({
        where: { ...scope, status: "PENDING", startTime: { gt: now }, userId: { not: me } },
        include: { room: ROOM, user: REQUESTER },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
      });
      pending.forEach((b) => items.push(item("approval", b.createdAt, b)));

      const cancelled = await prisma.booking.findMany({
        where: { ...scope, status: "CANCELLED", updatedAt: { gte: since }, endTime: { gt: now }, userId: { not: me } },
        include: { room: ROOM, user: REQUESTER },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      cancelled.forEach((b) => items.push(item("cancelled", b.updatedAt, b)));
    }

    const mine = await prisma.booking.findMany({
      where: {
        userId: me,
        OR: [
          { status: { in: ["APPROVED", "REJECTED"] }, updatedAt: { gte: since } },
          { status: "APPROVED", startTime: { gt: now, lt: new Date(now.getTime() + DAY) } },
        ],
      },
      include: { room: ROOM },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
    });
    for (const b of mine) {
      if (b.updatedAt >= since) items.push(item(b.status === "APPROVED" ? "approved" : "rejected", b.updatedAt, b));
      if (b.status === "APPROVED" && b.startTime > now && b.startTime.getTime() - now.getTime() < DAY) {
        // The reminder "arrives" 24 h before the meeting (or at approval, if later).
        const at = new Date(Math.max(b.startTime.getTime() - DAY, b.updatedAt.getTime()));
        items.push(item("reminder", at, b));
      }
    }

    items.sort((a, b) => b.at.localeCompare(a.at));
    return NextResponse.json({
      items: items.slice(0, LIMIT),
      pendingCount: items.filter((i) => i.type === "approval").length,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
    return NextResponse.json({ error: "โหลดการแจ้งเตือนไม่สำเร็จ" }, { status: 500 });
  }
}
