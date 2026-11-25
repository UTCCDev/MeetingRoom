import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";
import { bookingRecipients, onBookingApproved } from "@/lib/booking-approval";
import { sendBookingNotification } from "@/lib/email";
import { deleteRoomEvent, isRoomCalendarConfigured } from "@/lib/room-calendar";
import { canCancel, canDecide, canTransition } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

// Never include the full user row: it carries the password hash.
const USER_PUBLIC = { select: { id: true, name: true, email: true } } as const;
const INCLUDE = { room: { include: { approvers: { select: { id: true } } } }, user: USER_PUBLIC, bookedFor: USER_PUBLIC, approvedBy: USER_PUBLIC, department: { select: { id: true, name: true } } } as const;

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const UNAUTHORIZED = () => NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });

// GET a specific booking. Any signed-in user may read it (room calendars show everyone the details);
// approving and cancelling are still restricted below.
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const actor = await loadActor((await getServerSession(authOptions)) as any);
    if (!actor) return UNAUTHORIZED();

    const booking = await prisma.booking.findUnique({ where: { id }, include: INCLUDE });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// PUT approve/reject. Approvers may decide their own requests; approvedById records who decided.
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const actor = await loadActor((await getServerSession(authOptions)) as any);
    if (!actor) return UNAUTHORIZED();

    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    const decisionNote = typeof body?.decisionNote === "string" ? body.decisionNote.trim() : "";

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }

    if (status === "REJECTED" && !rejectionReason) {
      return NextResponse.json({ error: "กรุณาระบุเหตุผลในการปฏิเสธ" }, { status: 400 });
    }

    if (rejectionReason.length > 500 || decisionNote.length > 500) {
      return NextResponse.json({ error: "ข้อความยาวเกิน 500 ตัวอักษร" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id }, include: INCLUDE });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
    }

    if (!canDecide(actor, booking.room)) {
      return NextResponse.json(
        {
          error: booking.room.requiresPresidentApproval
            ? "ห้องนี้ต้องให้ผู้มีสิทธิ์อนุมัติแทนอธิการฯ เป็นผู้อนุมัติ"
            : "คุณไม่มีสิทธิ์อนุมัติหรือปฏิเสธการจองนี้",
        },
        { status: 403 }
      );
    }

    if (!canTransition(booking.status, status)) {
      return NextResponse.json({ error: "คำขอนี้ถูกตัดสินแล้ว" }, { status: 409 });
    }

    if (status === "APPROVED" && booking.startTime <= new Date()) {
      return NextResponse.json(
        { error: "คำขอนี้เลยเวลาเริ่มประชุมแล้ว ไม่สามารถอนุมัติได้" },
        { status: 409 }
      );
    }

    // Conditional update guards against two approvers deciding at the same time.
    const { count } = await prisma.booking.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        approvedById: actor.id,
        decisionNote: decisionNote || null,
      },
    });

    if (count === 0) {
      return NextResponse.json({ error: "คำขอนี้ถูกตัดสินแล้ว" }, { status: 409 });
    }

    if (status === "APPROVED") {
      await onBookingApproved(id);
    } else {
      try {
        await sendBookingNotification(
          bookingRecipients(booking),
          booking.title,
          "REJECTED",
          booking.room.name,
          booking.startTime,
          rejectionReason
        );
      } catch (emailError) {
        console.error("Email notification failed, but booking was updated:", emailError);
      }
    }

    const updatedBooking = await prisma.booking.findUnique({ where: { id }, include: INCLUDE });
    return NextResponse.json(updatedBooking);
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// DELETE cancel a booking (booker or beneficiary; pending or approved, not yet finished)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const actor = await loadActor((await getServerSession(authOptions)) as any);
    if (!actor) return UNAUTHORIZED();

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { room: { select: { calendarEmail: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
    }

    if (!canCancel(actor.id, booking)) {
      return NextResponse.json(
        { error: "ยกเลิกได้เฉพาะผู้จอง หรือผู้ที่ถูกจองให้เท่านั้น" },
        { status: 403 }
      );
    }

    if (!canTransition(booking.status, "CANCELLED")) {
      return NextResponse.json(
        { error: "การจองนี้ยกเลิกไม่ได้ เนื่องจากถูกปฏิเสธหรือยกเลิกไปแล้ว" },
        { status: 409 }
      );
    }

    if (booking.endTime <= new Date()) {
      return NextResponse.json(
        { error: "การประชุมนี้สิ้นสุดแล้ว ไม่สามารถยกเลิกได้" },
        { status: 409 }
      );
    }

    await prisma.booking.updateMany({
      where: { id, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "CANCELLED" },
    });

    // Free the slot on the room display too.
    if (booking.graphEventId && booking.room.calendarEmail && isRoomCalendarConfigured()) {
      try {
        await deleteRoomEvent(booking.room.calendarEmail, booking.graphEventId);
        await prisma.booking.update({ where: { id }, data: { graphEventId: null } });
      } catch (calendarError) {
        console.error(`Room calendar removal failed for ${booking.room.calendarEmail}, but booking was cancelled:`, calendarError);
      }
    }

    return NextResponse.json({ message: "ยกเลิกการจองเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
