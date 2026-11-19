import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";
import { onBookingApproved } from "@/lib/booking-approval";
import { sendApprovalRequest } from "@/lib/email";
import { approvalRoute, createBookingSchema, firstError, normalizeBeneficiary } from "@/lib/validation";

const USER_PUBLIC = { select: { id: true, name: true, email: true } } as const;
const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";

// GET bookings the signed-in user made or that were made for them
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const me = (session.user as any).id as string;
    const bookings = await prisma.booking.findMany({
      where: { OR: [{ userId: me }, { bookedForId: me }] },
      include: { room: true, user: USER_PUBLIC, bookedFor: USER_PUBLIC, department: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// POST create a new booking; approval route depends on the room and the booker's/beneficiary's flags
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const booker = await loadActor(session as any);

    if (!booker) {
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

    const bookedForId = normalizeBeneficiary(booker.id, data.bookedForId);
    const beneficiary = bookedForId ? await loadActor({ user: { id: bookedForId } }) : null;
    if (bookedForId && !beneficiary) {
      return NextResponse.json(
        { error: "ไม่พบผู้ประสานงาน หรือบัญชีถูกปิดใช้งาน", field: "bookedForId" },
        { status: 400 }
      );
    }

    const departmentId = data.departmentId || null;
    if (departmentId && !(await prisma.department.findUnique({ where: { id: departmentId } }))) {
      return NextResponse.json({ error: "ไม่พบหน่วยงานที่เลือก", field: "departmentId" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      include: {
        roomAdmin: { select: { id: true, email: true } },
        approvers: { where: { active: true }, select: { id: true, email: true } },
      },
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

    const route = approvalRoute(booker, beneficiary, room);
    const auto = route === "AUTO";

    const booking = await prisma.booking.create({
      data: {
        userId: booker.id,
        bookedForId,
        departmentId,
        roomId: data.roomId,
        title: data.title,
        description: data.description || null,
        attendees: data.attendees,
        startTime: data.startTime,
        endTime: data.endTime,
        status: auto ? "APPROVED" : "PENDING",
        autoApproved: auto,
        approvedById: auto ? booker.id : null,
      },
      include: { room: true, user: USER_PUBLIC, bookedFor: USER_PUBLIC, department: { select: { id: true, name: true } } },
    });

    if (auto) {
      await onBookingApproved(booking.id);
    } else {
      // Tell whoever can approve. Not awaited: a slow mail server must not delay the booking.
      const approvers =
        route === "PRESIDENT"
          ? (
              await prisma.user.findMany({
                where: { isPresidentApprover: true, active: true, role: { in: ["ROOM_ADMIN", "SYSTEM_ADMIN"] } },
                select: { email: true },
              })
            ).map((u) => u.email)
          : [...new Set([room.roomAdmin.email, ...room.approvers.map((a) => a.email)])];
      if (approvers.length === 0 && route === "PRESIDENT") {
        console.warn(
          `[booking] ${booking.id} in ${room.name} needs a president approver, but no active ROOM_ADMIN/SYSTEM_ADMIN has isPresidentApprover; it will stay PENDING.`
        );
      }
      if (approvers.length > 0) {
        sendApprovalRequest(approvers, booking, room.name, booking.user.name).catch((err) =>
          console.error("Approval request email failed:", err)
        );
      }
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
