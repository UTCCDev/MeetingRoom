import { toDateKey } from "@/lib/format";
import type { Dept, SStatus } from "@/lib/service-rules";

// Shapes and pure helpers shared by the service-request pages (client side).

export interface ServiceUser {
  id: string;
  name: string;
  email: string;
}

export interface ServiceRow {
  id: string;
  department: Dept;
  status: SStatus;
  bookingId: string | null;
  requesterId: string;
  location: string | null;
  startTime: string;
  endTime: string;
  contactPhone: string;
  note: string | null;
  waitingRoom: boolean;
  assigneeId: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  internalNote: string | null;
  rejectionReason: string | null;
  borrowedAt: string | null;
  returnedAt: string | null;
  items: { id: string; qty: number; otherText: string | null; catalogItem: { name: string; returnable?: boolean } | null }[];
  requester: ServiceUser;
  assignee: ServiceUser | null;
  booking: { id: string; title: string; room: { name: string } } | null;
  attachments?: { id: string; fileName: string; originalName?: string; url: string }[];
}

export const BADGE: Record<SStatus, string> = {
  PENDING: "badge-pending",
  ACCEPTED: "badge-primary",
  IN_PROGRESS: "badge-primary",
  DONE: "badge-available",
  REJECTED: "badge-neutral",
  CANCELLED: "badge-neutral",
};

export const STATUS_ORDER: SStatus[] = ["PENDING", "ACCEPTED", "IN_PROGRESS", "DONE", "REJECTED", "CANCELLED"];

export function countByStatus(rows: { status: SStatus }[]): Record<SStatus, number> {
  const out = { PENDING: 0, ACCEPTED: 0, IN_PROGRESS: 0, DONE: 0, REJECTED: 0, CANCELLED: 0 } as Record<SStatus, number>;
  for (const r of rows) out[r.status] += 1;
  return out;
}

export function filterRows(rows: ServiceRow[], f: { status?: SStatus; q?: string; date?: string }): ServiceRow[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.date && toDateKey(r.startTime) !== f.date) return false;
    if (!q) return true;
    const hay = [r.requester?.name, r.requester?.email, r.booking?.room.name, r.location, r.booking?.title]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return hay.includes(q);
  });
}

export const itemsText = (items: ServiceRow["items"]) =>
  items.map((i) => `${i.catalogItem?.name ?? i.otherText ?? ""} × ${i.qty}`).join(", ");

/** A catalog item flagged returnable is on the request, so the return date is required to finish it. */
export const needsReturn = (items: ServiceRow["items"]) => items.some((i) => !i.otherText && i.catalogItem?.returnable);

export async function postJson(url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
  return data;
}
