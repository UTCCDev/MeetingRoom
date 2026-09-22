import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBookingNotification } from "@/lib/email";

// GET a specific booking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        room: true,
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e01\u0e32\u0e23\u0e08\u0e2d\u0e07\u0e19\u0e35\u0e49" },
        { status: 404 }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e41\u0e14\u0e01\u0e01\u0e25\u0e32\u0e07\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e2d\u0e2d\u0e23\u0e4c" },
      { status: 500 }
    );
  }
}

// PUT update booking status (approve/reject)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15" },
        { status: 401 }
      );
    }

    const { status, rejectionReason } = await request.json();

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "\u0e2a\u0e16\u0e32\u0e19\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        room: true,
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e01\u0e32\u0e23\u0e08\u0e2d\u0e07\u0e19\u0e35\u0e49" },
        { status: 404 }
      );
    }

    // Check if user has permission to approve this booking
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    if (
      userRole === "ROOM_ADMIN" &&
      booking.room.roomAdminId !== userId
    ) {
      return NextResponse.json(
        { error: "\u0e04\u0e38\u0e13\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e43\u0e08\u0e27\u0e31\u0e2a\u0e19\u0e41\u0e25\u0e30\u0e1a\u0e31\u0e15\u0e23\u0e34\u0e21\u0e02\u0e2d\u0e07ห้องของ\u0e04\u0e38\u0e13\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19" },
        { status: 403 }
      );
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
      },
      include: {
        room: true,
        user: true,
      },
    });

    // Send email notification
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE cancel a booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Check if user owns the booking
    if (booking.userId !== (session.user as any).id) {
      return NextResponse.json(
        { error: "You can only cancel your own bookings" },
        { status: 403 }
      );
    }

    await prisma.booking.update({
      where: { id: params.id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
