import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBookingNotification } from "@/lib/email";
import { canDecide, canTransition, canView } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

// Never include the full user row: it carries the password hash.
const USER_PUBLIC = { select: { id: true, name: true, email: true } } as const;

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";

function sessionUser(session: any) {
  return { id: session.user.id as string, role: session.user.role as string };
}

// GET a specific booking (owner, room admin of that room, or system admin)
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
        user: USER_PUBLIC,
      },
    });

    // Respond 404 rather than 403 so booking ids can't be probed.
    if (!booking || !canView(sessionUser(session), booking)) {
      return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// PUT update booking status (approve/reject)
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    const rejectionReason =
      typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() : "";

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }

    if (status === "REJECTED" && !rejectionReason) {
      return NextResponse.json({ error: "กรุณาระบุเหตุผลในการปฏิเสธ" }, { status: 400 });
    }

    if (rejectionReason.length > 500) {
      return NextResponse.json({ error: "เหตุผลยาวเกิน 500 ตัวอักษร" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
        user: USER_PUBLIC,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
    }

    const user = sessionUser(session);

    if (!canDecide(user, booking.room)) {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์อนุมัติหรือปฏิเสธการจองนี้" },
        { status: 403 }
      );
    }

    // Separation of duties: nobody decides on their own request.
    if (booking.userId === user.id) {
      return NextResponse.json(
        { error: "ไม่สามารถอนุมัติหรือปฏิเสธคำขอของตัวเองได้ กรุณาให้ผู้ดูแลท่านอื่นเป็นผู้ตัดสิน" },
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

    // Conditional update guards against two admins deciding at the same time.
    const { count } = await prisma.booking.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
      },
    });

    if (count === 0) {
      return NextResponse.json({ error: "คำขอนี้ถูกตัดสินแล้ว" }, { status: 409 });
    }

    const updatedBooking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
        user: USER_PUBLIC,
      },
    });

    try {
      await sendBookingNotification(
        booking.user.email,
        booking.title,
        status,
        booking.room.name,
        booking.startTime,
        status === "REJECTED" ? rejectionReason : undefined
      );
    } catch (emailError) {
      console.error("Email notification failed, but booking was updated:", emailError);
    }

    return NextResponse.json(updatedBooking);
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// DELETE cancel a booking (owner only; pending or approved, not yet finished)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบการจองนี้" }, { status: 404 });
    }

    if (booking.userId !== (session.user as any).id) {
      return NextResponse.json(
        { error: "คุณสามารถยกเลิกการจองของคุณเองเท่านั้น" },
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

    return NextResponse.json({ message: "ยกเลิกการจองเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
