import { prisma } from "@/lib/prisma";
import { notifyNewRequest, notifyCancelled } from "@/lib/service-notify";

const log = (p: Promise<unknown>) => p.catch((e) => console.error("service notify failed:", e));

/**
 * A booking was approved: its hidden PENDING service requests become visible
 * to the departments. Never throws, so it cannot fail the booking change.
 */
export async function onBookingApprovedServices(bookingId: string): Promise<void> {
  try {
    const where = { bookingId, status: "PENDING" as const, visibleAt: null };
    const rows = await prisma.serviceRequest.findMany({ where, select: { id: true } });
    if (rows.length === 0) return;
    await prisma.serviceRequest.updateMany({ where, data: { visibleAt: new Date() } });
    for (const r of rows) log(notifyNewRequest(r.id));
  } catch (error) {
    console.error("Service request sync failed after booking approval:", error);
  }
}

/**
 * A booking was rejected or cancelled: cancel its PENDING/ACCEPTED service
 * requests (IN_PROGRESS, DONE and REJECTED are left alone). Only requests the
 * department had already seen are announced. Never throws.
 */
export async function onBookingClosedServices(bookingId: string, _kind: "REJECTED" | "CANCELLED"): Promise<void> {
  try {
    const where = { bookingId, status: { in: ["PENDING", "ACCEPTED"] as ("PENDING" | "ACCEPTED")[] } };
    const rows = await prisma.serviceRequest.findMany({ where, select: { id: true, visibleAt: true } });
    if (rows.length === 0) return;
    await prisma.serviceRequest.updateMany({ where, data: { status: "CANCELLED", cancelledAt: new Date() } });
    for (const r of rows) if (r.visibleAt) log(notifyCancelled(r.id));
  } catch (error) {
    console.error("Service request sync failed after booking close:", error);
  }
}
