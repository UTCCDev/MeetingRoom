import { prisma } from "@/lib/prisma";
import { sendBookingNotification } from "@/lib/email";
import { onBookingApprovedServices } from "@/lib/service-booking-sync";
import { createRoomEvent, isRoomCalendarConfigured } from "@/lib/room-calendar";

const PERSON = { select: { name: true, email: true } } as const;

/** Booker plus beneficiary, without duplicates. */
export function bookingRecipients(b: { user: { email: string }; bookedFor?: { email: string } | null }): string[] {
  return [...new Set([b.user.email, b.bookedFor?.email].filter((e): e is string => !!e))];
}

/**
 * Side effects once a booking is APPROVED (by an approver or automatically):
 * put it on the room's display calendar and email booker + beneficiary.
 * Failures are logged; they never undo the approval.
 */
export async function onBookingApproved(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: true, user: PERSON, bookedFor: PERSON },
  });
  if (!booking) return;

  await onBookingApprovedServices(bookingId);

  if (booking.room.calendarEmail && isRoomCalendarConfigured()) {
    try {
      // The door display shows the person the room is for.
      const graphEventId = await createRoomEvent(booking.room.calendarEmail, {
        ...booking,
        user: booking.bookedFor ?? booking.user,
      });
      await prisma.booking.update({ where: { id: bookingId }, data: { graphEventId } });
    } catch (error) {
      console.error(`Room calendar sync failed for ${booking.room.calendarEmail}, but booking was approved:`, error);
    }
  }

  try {
    await sendBookingNotification(bookingRecipients(booking), booking.title, "APPROVED", booking.room.name, booking.startTime);
  } catch (error) {
    console.error("Approval email failed, but booking was approved:", error);
  }
}
