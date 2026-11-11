import { prisma } from "@/lib/prisma";
import { DEPT_LABEL, deptParam as seg, type Dept, type Membership } from "@/lib/service-rules";
import type { ServiceNotificationItem, ServiceNotificationType } from "@/lib/notifications";

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 30;
const LIMIT = 40;

const INCLUDE = {
  requester: { select: { id: true, name: true, email: true } },
  items: { select: { catalogItem: { select: { returnable: true } } } },
} as const;

type Row = {
  id: string;
  department: Dept;
  status: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  visibleAt: Date | null;
  assignedAt: Date | null;
  decidedAt: Date | null;
  cancelledAt: Date | null;
  rejectionReason: string | null;
  requester: { name: string } | null;
  items: { catalogItem: { returnable: boolean } | null }[];
  booking?: { room: { name: string } } | null;
};

function make(type: ServiceNotificationType, at: Date, r: Row, href: string): ServiceNotificationItem {
  return {
    id: `${type}:${r.id}`,
    type,
    at: at.toISOString(),
    service: {
      requestId: r.id,
      department: r.department,
      deptLabel: DEPT_LABEL[r.department],
      startTime: r.startTime.toISOString(),
      location: r.location ?? r.booking?.room.name ?? "",
      requesterName: r.requester?.name ?? "",
      reason: type === "svc_rejected" ? r.rejectionReason : undefined,
      href,
    },
  };
}

/**
 * Service-request notifications derived from the requests themselves (no table):
 *  - department admins: new visible requests, cancellations, unreturned equipment
 *  - assignee: assignments, cancellations, work starting within 24 h
 *  - requester: accept / reject / done decisions
 * Hidden requests (visibleAt null) never notify a department.
 */
export async function serviceNotifications(
  userId: string,
  memberships: Membership[],
  now: Date,
): Promise<ServiceNotificationItem[]> {
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY);
  const soon = new Date(now.getTime() + DAY);
  const out = new Map<string, ServiceNotificationItem>();
  // First entry wins; roles are processed admin, assignee, requester, so admin links take priority.
  const add = (i: ServiceNotificationItem) => {
    if (!out.has(i.id)) out.set(i.id, i);
  };
  const inRoom = { booking: { select: { room: { select: { name: true } } } } } as const;
  const include = { ...INCLUDE, ...inRoom };

  const adminDepts = memberships.filter((m) => m.role === "ADMIN").map((m) => m.department);
  if (adminDepts.length) {
    const rows = (await prisma.serviceRequest.findMany({
      where: {
        department: { in: adminDepts },
        visibleAt: { not: null },
        OR: [
          { status: "PENDING", visibleAt: { gte: since } },
          { status: "CANCELLED", cancelledAt: { gte: since } },
          { status: "IN_PROGRESS", endTime: { lt: now }, items: { some: { catalogItem: { returnable: true } } } },
        ],
      },
      include,
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
    })) as unknown as Row[];
    for (const r of rows) {
      if (!r.visibleAt || !adminDepts.includes(r.department)) continue;
      if (r.status === "PENDING" && r.visibleAt >= since) add(make("svc_new", r.visibleAt, r, `/services/${seg(r.department)}`));
      else if (r.status === "CANCELLED" && r.cancelledAt && r.cancelledAt >= since) add(make("svc_cancelled", r.cancelledAt, r, `/services/${seg(r.department)}`));
      else if (
        r.status === "IN_PROGRESS" &&
        r.endTime < now &&
        r.items.some((i) => i.catalogItem?.returnable)
      ) {
        add(make("svc_overdue", r.endTime, r, `/services/${seg(r.department)}`));
      }
    }
  }

  const mine = (await prisma.serviceRequest.findMany({
    where: {
      assigneeId: userId,
      OR: [
        { assignedAt: { gte: since } },
        { status: "CANCELLED", cancelledAt: { gte: since } },
        { status: { in: ["ACCEPTED", "IN_PROGRESS"] }, startTime: { gt: now, lt: soon } },
      ],
    },
    include,
    orderBy: { updatedAt: "desc" },
    take: LIMIT,
  })) as unknown as (Row & { assigneeId?: string | null })[];
  for (const r of mine) {
    if (r.assignedAt && r.assignedAt >= since && r.status !== "CANCELLED") add(make("svc_assigned", r.assignedAt, r, `/services/${seg(r.department)}/assigned`));
    if (r.status === "CANCELLED" && r.cancelledAt && r.cancelledAt >= since) add(make("svc_cancelled", r.cancelledAt, r, `/services/${seg(r.department)}/assigned`));
    if ((r.status === "ACCEPTED" || r.status === "IN_PROGRESS") && r.startTime > now && r.startTime < soon) {
      // Arrives 24 h before start (or at assignment, if later).
      const at = new Date(Math.max(r.startTime.getTime() - DAY, r.assignedAt?.getTime() ?? 0));
      add(make("svc_soon", at, r, `/services/${seg(r.department)}/assigned`));
    }
  }

  const decided = (await prisma.serviceRequest.findMany({
    where: { requesterId: userId, status: { in: ["ACCEPTED", "REJECTED", "DONE"] }, decidedAt: { gte: since } },
    include,
    orderBy: { decidedAt: "desc" },
    take: LIMIT,
  })) as unknown as Row[];
  for (const r of decided) {
    if (!r.decidedAt || r.decidedAt < since) continue;
    const type = r.status === "ACCEPTED" ? "svc_accepted" : r.status === "REJECTED" ? "svc_rejected" : r.status === "DONE" ? "svc_done" : null;
    if (type) add(make(type, r.decidedAt, r, "/services/mine"));
  }

  return [...out.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
}
