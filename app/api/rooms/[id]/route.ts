import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomSchema } from "@/lib/room-schema";
import { firstError } from "@/lib/validation";

// GET a specific room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id: id },
      include: {
        roomAdmin: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "ไม่พบห้องนี้" },
        { status: 404 }
      );
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}

// PUT update room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: id },
    });

    if (!room) {
      return NextResponse.json(
        { error: "ไม่พบห้องนี้" },
        { status: 404 }
      );
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    // Check permission: only room admin or system admin can update
    if (
      userRole === "ROOM_ADMIN" &&
      room.roomAdminId !== userId
    ) {
      return NextResponse.json(
        { error: "คุณสามารถแก้ไขได้เฉพาะห้องของคุณเท่านั้น" },
        { status: 403 }
      );
    }

    if (userRole === "USER") {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์แก้ไขห้องนี้" },
        { status: 403 }
      );
    }

    const parsed = roomSchema
      .partial()
      .safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const { name, description, capacity, image, amenities, status, roomAdminId } = parsed.data;

    // Only system admins can hand a room to another admin.
    if (roomAdminId !== undefined && roomAdminId !== room.roomAdminId) {
      if (userRole !== "SYSTEM_ADMIN") {
        return NextResponse.json(
          { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนผู้ดูแลห้องได้" },
          { status: 403 }
        );
      }
      const newAdmin = await prisma.user.findUnique({ where: { id: roomAdminId } });
      if (!newAdmin || newAdmin.role === "USER") {
        return NextResponse.json({ error: "ไม่พบผู้ดูแลห้อง" }, { status: 404 });
      }
    }

    const updatedRoom = await prisma.room.update({
      where: { id: id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(capacity && { capacity }),
        ...(image !== undefined && { image: image || null }),
        ...(amenities && { amenities }),
        ...(status !== undefined && { status }),
        ...(roomAdminId && { roomAdminId }),
      },
      include: {
        roomAdmin: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}

// DELETE a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;

    // Only system admin can delete rooms
    if (userRole !== "SYSTEM_ADMIN") {
      return NextResponse.json(
        { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่ลบห้องได้" },
        { status: 403 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: id },
    });

    if (!room) {
      return NextResponse.json(
        { error: "ไม่พบห้องนี้" },
        { status: 404 }
      );
    }

    // If the room still has active bookings, deleting it would orphan
    // those bookings. Disable the room instead (soft delete).
    const activeBookingCount = await prisma.booking.count({
      where: {
        roomId: id,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (activeBookingCount > 0) {
      await prisma.room.update({
        where: { id: id },
        data: { status: false },
      });

      return NextResponse.json({
        message: "ห้องนี้มีการจองค้างอยู่ จึงถูกปิดใช้งานแทนการลบ",
        softDeleted: true,
      });
    }

    await prisma.room.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: "ลบห้องเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
