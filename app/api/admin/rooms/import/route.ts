import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importDescription, ownerKey, parseRoomSheet } from "@/lib/room-import";

const bodySchema = z.object({
  text: z.string().max(2_000_000, "ข้อมูลใหญ่เกินไป"),
  // false = preview only, nothing is written.
  commit: z.boolean().optional(),
});

// POST replaces every room with the rows of an Excel sheet. Old rooms and
// their bookings are deleted in the same transaction as the insert.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }
    if (user.role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่นำเข้าห้องได้" }, { status: 403 });
    }

    const body = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const { rooms, errors, warnings } = parseRoomSheet(body.data.text);

    // Match each Owner to a room admin named after that unit; unmatched rooms go to the importer.
    const admins = await prisma.user.findMany({
      where: { role: "ROOM_ADMIN", active: true },
      select: { id: true, name: true },
    });
    const adminByOwner = new Map(admins.map((a) => [ownerKey(a.name), a]));
    const assigned = rooms.map((room) => {
      const admin = adminByOwner.get(ownerKey(room.owner));
      return {
        ...room,
        roomAdminId: admin?.id ?? user.id,
        roomAdminName: admin?.name ?? `${user.name} (ยังไม่มีผู้ดูแลของหน่วยงานนี้)`,
        adminMatched: !!admin,
      };
    });

    if (!body.data.commit) {
      const [existingRooms, existingBookings] = await Promise.all([prisma.room.count(), prisma.booking.count()]);
      return NextResponse.json({ rooms: assigned, errors, warnings, existingRooms, existingBookings });
    }

    if (errors.length) {
      return NextResponse.json({ error: "ยังมีแถวที่ไม่ถูกต้อง กรุณาแก้ไขก่อนนำเข้า", errors }, { status: 400 });
    }

    const [deletedBookings, deletedRooms, created] = await prisma.$transaction([
      prisma.booking.deleteMany(),
      prisma.room.deleteMany(),
      prisma.room.createMany({
        data: assigned.map((room) => ({
          code: room.code,
          roomType: room.roomType,
          roomNumber: room.roomNumber,
          name: room.name,
          description: importDescription(room),
          capacity: room.capacity,
          pricePerHour: room.pricePerHour,
          roomAdminId: room.roomAdminId,
          status: true,
        })),
      }),
    ]);

    return NextResponse.json({
      created: created.count,
      deletedRooms: deletedRooms.count,
      deletedBookings: deletedBookings.count,
    });
  } catch (error) {
    console.error("Error importing rooms:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" }, { status: 500 });
  }
}
