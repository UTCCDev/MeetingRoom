import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBookingSchema, firstError } from "@/lib/validation";

const USER_PUBLIC = { select: { id: true, name: true, email: true } } as const;

// GET all bookings for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: (session.user as any).id,
      },
      include: {
        room: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}

// POST create a new booking
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createBookingSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstError(parsed.error), field: parsed.error.issues[0]?.path[0] },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.status) {
      return NextResponse.json({ error: "ไม่พบห้องนี้หรือห้องปิดใช้งาน" }, { status: 404 });
    }

    if (data.attendees > room.capacity) {
      return NextResponse.json(
        { error: `จำนวนผู้เข้าร่วมเกินความจุห้อง (สูงสุด ${room.capacity} คน)`, field: "attendees" },
        { status: 400 }
      );
    }

    // Two ranges overlap when existing.start < new.end AND existing.end > new.start.
    // Strict comparisons let back-to-back bookings (09:00–10:00, 10:00–11:00) through.
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: data.roomId,
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "ห้องไม่ว่างสำหรับช่วงเวลานี้ กรุณาเลือกเวลาอื่น", field: "startTime" },
        { status: 409 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        userId: (session.user as any).id,
        roomId: data.roomId,
        title: data.title,
        description: data.description || null,
        attendees: data.attendees,
        startTime: data.startTime,
        endTime: data.endTime,
        status: "PENDING",
      },
      include: {
        room: true,
        user: USER_PUBLIC,
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
