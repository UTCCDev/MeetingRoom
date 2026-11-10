import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";
import { decidableRoomWhere } from "@/lib/validation";

const PERSON = {
  select: { id: true, name: true, email: true, department: { select: { name: true } } },
} as const;

// GET pending bookings the signed-in user may decide (same scope as canDecide).
// Includes requests whose meeting already started; the page shows those separately as read-only.
export async function GET(request: NextRequest) {
  try {
    const actor = await loadActor((await getServerSession(authOptions)) as any);

    if (!actor) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const rooms = decidableRoomWhere(actor);
    if (!rooms) {
      return NextResponse.json({ error: "เฉพาะผู้ดูแลเท่านั้นที่เข้าถึงส่วนนี้ได้" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { status: "PENDING", room: rooms },
      include: { room: true, user: PERSON, bookedFor: PERSON },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" }, { status: 500 });
  }
}
