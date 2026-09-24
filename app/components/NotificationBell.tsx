"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";
import { formatRange, roomLocation } from "@/lib/format";
import { timeAgo, type NotificationItem, type NotificationType } from "@/lib/notifications";

const POLL_MS = 60_000;
/** Fired after a decision so open pages (e.g. อนุมัติการจอง) can refetch. */
export const BOOKING_DECIDED_EVENT = "booking-decided";

const LOOK: Record<NotificationType, { icon: string; tone: string }> = {
  approval: { icon: "pending_actions", tone: "bg-highlight/25 text-ink" },
  approved: { icon: "check_circle", tone: "bg-[#EEF9F2] text-success" },
  rejected: { icon: "cancel", tone: "bg-[#FDF1F1] text-error" },
  cancelled: { icon: "event_busy", tone: "bg-gray-100 text-ink-muted" },
  reminder: { icon: "alarm", tone: "bg-primary-container text-primary" },
};

function headline(n: NotificationItem): React.ReactNode {
  const t = <span className="font-medium text-ink">“{n.title}”</span>;
  switch (n.type) {
    case "approval":
      return <><span className="font-medium text-ink">{n.requester?.name}</span> ขอจอง {n.roomName}</>;
    case "approved":
      return <>การจอง {t} ได้รับการอนุมัติแล้ว</>;
    case "rejected":
      return <>การจอง {t} ถูกปฏิเสธ</>;
    case "cancelled":
      return <><span className="font-medium text-ink">{n.requester?.name}</span> ยกเลิกการจอง {t}</>;
    case "reminder":
      return <>ใกล้ถึงเวลาประชุม {t}</>;
  }
}

export default function NotificationBell({ userId, isApprover }: { userId: string; isApprover: boolean }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  const [highlightAfter, setHighlightAfter] = useState(0); // unread marker kept while the panel is open
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const storageKey = `notif-seen:${userId}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // offline or server hiccup — keep the last list
    }
  }, []);

  useEffect(() => {
    try {
      setSeenAt(Number(localStorage.getItem(storageKey)) || 0);
    } catch {
      /* storage blocked */
    }
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(BOOKING_DECIDED_EVENT, onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(BOOKING_DECIDED_EVENT, onFocus);
    };
  }, [load, storageKey]);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(storageKey, String(now));
    } catch {
      /* storage blocked */
    }
  };

  const toggle = () => {
    if (!open) {
      setHighlightAfter(seenAt);
      markSeen();
      load();
    }
    setOpen((o) => !o);
  };

  const decide = async (n: NotificationItem, status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !reason.trim()) {
      setReasonError("กรุณาระบุเหตุผลในการปฏิเสธ");
      return;
    }
    setBusy(n.id);
    try {
      const res = await fetch(`/api/bookings/${n.bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "APPROVED" ? { status } : { status, rejectionReason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      setItems((list) => list.filter((i) => i.id !== n.id));
      setRejecting(null);
      setReason("");
      toast(status === "APPROVED" ? `อนุมัติ “${n.title}” แล้ว` : `ปฏิเสธ “${n.title}” แล้ว`, { type: "success" });
      window.dispatchEvent(new Event(BOOKING_DECIDED_EVENT));
    } catch (err) {
      toast(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ", { type: "error" });
      load();
    } finally {
      setBusy(null);
    }
  };

  const unread = items.filter((i) => new Date(i.at).getTime() > seenAt).length;
  const approvals = items.filter((i) => i.type === "approval");
  const updates = items.filter((i) => i.type !== "approval");
  const isNew = (n: NotificationItem) => new Date(n.at).getTime() > highlightAfter;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="icon-button relative"
        aria-label={`การแจ้งเตือน${unread ? ` (${unread} รายการใหม่)` : ""}`}
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <span className={`icon icon--24 ${open ? "icon--fill icon--w500" : ""}`} aria-hidden="true">
          notifications
        </span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-error text-white text-label-small leading-5 text-center tabular-nums ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          role="dialog"
          aria-label="การแจ้งเตือน"
          className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-[28rem] z-40 bg-white border border-line rounded-m shadow-xl flex flex-col max-h-[calc(100vh-5rem)]"
        >
          <div className="flex items-center justify-between px-4 h-14 border-b border-line flex-none">
            <h2 className="text-title-small text-ink">การแจ้งเตือน</h2>
            <button type="button" onClick={load} className="icon-button -mr-2" aria-label="รีเฟรช">
              <span className="icon icon--20" aria-hidden="true">refresh</span>
            </button>
          </div>

          <div className="overflow-y-auto">
            {isApprover && (
              <section aria-label="รอคุณอนุมัติ">
                <h3 className="flex items-center gap-2 px-4 pt-3 pb-1 text-label-medium text-ink-subtle">
                  รอคุณอนุมัติ
                  <span className="badge-pending px-2 py-0 tabular-nums">{approvals.length}</span>
                </h3>
                {approvals.length === 0 ? (
                  <p className="flex items-center gap-2 px-4 pb-3 text-body-small text-ink-subtle">
                    <span className="icon icon--20 icon--w300" aria-hidden="true">task_alt</span>
                    ไม่มีคำขอค้าง
                  </p>
                ) : (
                  <ul>
                    {approvals.map((n) => {
                      const over = n.attendees > n.capacity;
                      return (
                        <li key={n.id} className={`px-4 py-3 border-b border-line ${isNew(n) ? "bg-primary-container/40" : ""}`}>
                          <div className="flex gap-3">
                            <span className={`inline-flex items-center justify-center w-10 h-10 flex-none rounded-full ${LOOK.approval.tone}`} aria-hidden="true">
                              <span className="icon icon--20 icon--w500">{LOOK.approval.icon}</span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-body-small text-ink-muted">{headline(n)}</p>
                              <p className="text-label-large text-ink truncate">{n.title}</p>
                              <p className="flex items-center gap-1 text-label-medium font-normal text-ink-subtle tabular-nums">
                                <span className="icon icon--20 icon--w300" aria-hidden="true">schedule</span>
                                {formatRange(n.startTime, n.endTime)}
                              </p>
                              <p className="flex items-center gap-1 text-label-medium font-normal text-ink-subtle">
                                <span className="icon icon--20 icon--w300" aria-hidden="true">group</span>
                                {n.attendees} คน / ความจุ {n.capacity}
                                {over && <span className="text-error font-medium">· เกินความจุ</span>}
                              </p>
                              <p className="text-label-small font-normal text-ink-subtle mt-0.5">{timeAgo(n.at)}</p>

                              {rejecting === n.id ? (
                                <div className="mt-2">
                                  <label htmlFor={`notif-reason-${n.id}`} className="sr-only">เหตุผลในการปฏิเสธ</label>
                                  <textarea
                                    id={`notif-reason-${n.id}`}
                                    rows={2}
                                    maxLength={500}
                                    autoFocus
                                    value={reason}
                                    onChange={(e) => {
                                      setReason(e.target.value);
                                      setReasonError("");
                                    }}
                                    placeholder="เหตุผลในการปฏิเสธ (จำเป็น)"
                                    className={`input-field text-body-small ${reasonError ? "border-error" : ""}`}
                                    aria-invalid={!!reasonError}
                                  />
                                  {reasonError && <p className="field-error">{reasonError}</p>}
                                  <div className="flex justify-end gap-3 mt-2">
                                    <button
                                      type="button"
                                      className="btn-text btn--s"
                                      onClick={() => {
                                        setRejecting(null);
                                        setReason("");
                                        setReasonError("");
                                      }}
                                    >
                                      ยกเลิก
                                    </button>
                                    <button type="button" className="btn-danger btn--s" disabled={busy === n.id} onClick={() => decide(n, "REJECTED")}>
                                      {busy === n.id ? "กำลังส่ง…" : "ยืนยันปฏิเสธ"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <button type="button" className="btn-primary btn--s" disabled={busy === n.id} onClick={() => decide(n, "APPROVED")}>
                                    <span className="icon icon--20 icon--w500" aria-hidden="true">check</span>
                                    {busy === n.id ? "กำลังอนุมัติ…" : "อนุมัติ"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn--s text-error hover:border-error hover:bg-[#FDF1F1]"
                                    disabled={busy === n.id}
                                    onClick={() => {
                                      setRejecting(n.id);
                                      setReason("");
                                      setReasonError("");
                                    }}
                                  >
                                    <span className="icon icon--20 icon--w500" aria-hidden="true">close</span>
                                    ปฏิเสธ
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            <section aria-label="อัปเดตล่าสุด">
              <h3 className="px-4 pt-3 pb-1 text-label-medium text-ink-subtle">อัปเดตล่าสุด</h3>
              {updates.length === 0 ? (
                <p className="flex items-center gap-2 px-4 pb-4 text-body-small text-ink-subtle">
                  <span className="icon icon--20 icon--w300" aria-hidden="true">notifications_off</span>
                  ยังไม่มีการแจ้งเตือน
                </p>
              ) : (
                <ul>
                  {updates.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={n.type === "cancelled" ? `/rooms/${n.roomId}` : "/my-bookings"}
                        onClick={() => setOpen(false)}
                        className={`flex gap-3 px-4 py-3 border-b border-line hover:bg-canvas ${isNew(n) ? "bg-primary-container/40" : ""}`}
                      >
                        <span className={`inline-flex items-center justify-center w-10 h-10 flex-none rounded-full ${LOOK[n.type].tone}`} aria-hidden="true">
                          <span className="icon icon--20 icon--w500">{LOOK[n.type].icon}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-small text-ink-muted">{headline(n)}</span>
                          <span className="block text-label-medium font-normal text-ink-subtle tabular-nums">
                            {n.roomName}
                            {roomLocation(n.roomDescription) && ` · ${roomLocation(n.roomDescription)}`} · {formatRange(n.startTime, n.endTime)}
                          </span>
                          {n.type === "rejected" && n.reason && (
                            <span className="block mt-1 text-label-medium font-normal text-error">เหตุผล: {n.reason}</span>
                          )}
                          <span className="block text-label-small font-normal text-ink-subtle mt-0.5">{timeAgo(n.at)}</span>
                        </span>
                        {isNew(n) && <span className="w-2 h-2 mt-2 flex-none rounded-full bg-primary" aria-label="ใหม่" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex-none flex justify-between gap-2 px-2 py-2 border-t border-line">
            <Link href="/my-bookings" onClick={() => setOpen(false)} className="btn-text btn--s">
              การจองของฉัน
            </Link>
            {isApprover && (
              <Link href="/admin/pending-approvals" onClick={() => setOpen(false)} className="btn-text btn--s">
                ดูคำขอทั้งหมด
                <span className="icon icon--20 icon--w500" aria-hidden="true">arrow_forward</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
