"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import BookingProgress from "@/app/components/BookingProgress";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { formatRange, roomLabel, STATUS_BADGE, STATUS_ICONS, STATUS_LABELS } from "@/lib/format";

interface Booking {
  id: string;
  title: string;
  description?: string;
  room: {
    id: string;
    name: string;
    description?: string;
  };
  startTime: string;
  endTime: string;
  status: string;
  attendees: number;
  rejectionReason?: string | null;
  createdAt?: string;
}


const ACTIVE_STATUSES = ["PENDING", "APPROVED"];

/** "เริ่มในอีก 25 นาที", "กำลังประชุม", "พรุ่งนี้" … for upcoming meetings. */
function timeUntil(start: Date, end: Date, now: Date): { label: string; urgent: boolean } | null {
  if (end <= now) return null;
  if (start <= now) return { label: "กำลังประชุม", urgent: true };
  const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000);
  if (minutes < 60) return { label: `เริ่มในอีก ${minutes} นาที`, urgent: true };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return { label: `เริ่มในอีก ${hours} ชม.${rest ? ` ${rest} นาที` : ""}`, urgent: hours < 3 };
  }
  const days = Math.round(hours / 24);
  return { label: days === 1 ? "พรุ่งนี้" : `อีก ${days} วัน`, urgent: false };
}

const STATUS_CLASS = STATUS_BADGE;

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [now, setNow] = useState(() => new Date());
  const [filter, setFilter] = useState<string>("ALL");
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchBookings();
    // Keep the "เริ่มในอีก X นาที" badges current.
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data);
    } catch (err) {
      setError("ไม่สามารถโหลดการจองได้");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    setIsCancelling(true);

    try {
      const response = await fetch(`/api/bookings/${pendingCancel.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "ไม่สามารถยกเลิกการจองได้");

      setBookings((bs) =>
        bs.map((b) => (b.id === pendingCancel.id ? { ...b, status: "CANCELLED" } : b))
      );
      toast("ยกเลิกการจองแล้ว", { type: "success" });
      setPendingCancel(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "ไม่สามารถยกเลิกการจองได้", { type: "error" });
    } finally {
      setIsCancelling(false);
    }
  };

  // Upcoming = still pending/approved and not finished. Everything else
  // (cancelled, rejected, finished) lives in the history tab.
  const isUpcoming = (b: Booking) =>
    ACTIVE_STATUSES.includes(b.status) && new Date(b.endTime) > now;

  const tabStatuses =
    tab === "upcoming" ? ["PENDING", "APPROVED"] : ["APPROVED", "PENDING", "REJECTED", "CANCELLED"];

  // Newest booking first (by when it was made); meeting time breaks ties.
  const visible = bookings
    .filter((b) => (tab === "upcoming" ? isUpcoming(b) : !isUpcoming(b)))
    .filter((b) => filter === "ALL" || b.status === filter)
    .sort((a, b) => {
      const created = new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      return created || new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

  const upcomingCount = bookings.filter(isUpcoming).length;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="การจองของฉัน" breadcrumbs={[{ label: "การจองของฉัน" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex border-b border-line mb-6" role="tablist">
          {[
            { value: "upcoming" as const, icon: "upcoming", label: "กำลังจะมาถึง", count: upcomingCount },
            { value: "history" as const, icon: "history", label: "ประวัติ", count: bookings.length - upcomingCount },
          ].map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => {
                setTab(t.value);
                setFilter("ALL");
              }}
              className={`flex items-center gap-2 px-4 h-12 text-label-large -mb-px border-b-[3px] transition-colors ${
                tab === t.value ? "border-primary text-primary" : "border-transparent text-ink-subtle hover:text-ink"
              }`}
            >
              <span className={`icon icon--20 ${tab === t.value ? "icon--w500 icon--fill" : "icon--w300"}`} aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
              <span
                className={`min-w-[1.75rem] px-2.5 py-2 leading-none rounded-full text-label-medium tabular-nums ${
                  tab === t.value ? "bg-primary text-white" : "bg-gray-100 text-ink-subtle"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {["ALL", ...tabStatuses].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-label-medium border transition-colors ${
                filter === value
                  ? "bg-primary-container text-on-primary-container border-primary-container"
                  : "bg-surface text-ink-muted border-outline hover:bg-surface-variant"
              }`}
            >
              {filter === value && <span className="icon icon--20 icon--w500" aria-hidden="true">check</span>}
              {value === "ALL" ? "ทั้งหมด" : STATUS_LABELS[value]}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert--error mb-6" role="alert">
            <span className="icon icon--24 icon--w500 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={3} />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <span className="icon icon--40 icon--w300 text-ink-subtle" aria-hidden="true">event_busy</span>
            <p className="mb-2">
              {bookings.length === 0
                ? "คุณยังไม่มีการจองใดๆ"
                : filter !== "ALL"
                ? "ไม่มีการจองที่ตรงกับตัวกรองที่เลือก"
                : tab === "upcoming"
                ? "ไม่มีการประชุมที่กำลังจะมาถึง"
                : "ยังไม่มีประวัติการจอง"}
            </p>
            <Link href="/rooms" className="btn-primary">
              <span className="icon icon--20 icon--w500" aria-hidden="true">search</span>
              ค้นหาห้องประชุม
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((booking) => {
              const cancellable = isUpcoming(booking);
              const countdown = cancellable
                ? timeUntil(new Date(booking.startTime), new Date(booking.endTime), now)
                : null;
              const muted = !cancellable;
              return (
                <div
                  key={booking.id}
                  className="card"
                >
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`card__title mb-2 ${muted ? "text-ink-muted" : "text-ink"}`}>
                        {booking.title}
                      </h3>
                      <p className="flex items-center gap-2 text-label-large text-ink tabular-nums">
                        <span className="icon icon--20 icon--w300 text-primary" aria-hidden="true">schedule</span>
                        {formatRange(booking.startTime, booking.endTime)}
                      </p>
                      <p className="flex items-center gap-2 card__body mt-1">
                        <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">location_on</span>
                        {roomLabel(booking.room)}
                      </p>
                      <p className="flex items-center gap-2 card__body">
                        <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">group</span>
                        <span className="tabular-nums">{booking.attendees}</span> คน
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={STATUS_CLASS[booking.status] || "badge-neutral"}>
                        <span className="icon icon--20 icon--w500" aria-hidden="true">
                          {STATUS_ICONS[booking.status] || "info"}
                        </span>
                        {STATUS_LABELS[booking.status] || booking.status}
                      </span>
                      {countdown && (
                        <span
                          className={`inline-flex items-center gap-1.5 py-2 pl-2.5 pr-3.5 rounded-full text-label-medium ${
                            countdown.urgent ? "bg-primary text-white" : "bg-primary-container text-on-primary-container"
                          }`}
                        >
                          <span className="icon icon--20 icon--w500" aria-hidden="true">timer</span>
                          {countdown.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="my-5 py-4 border-y border-line">
                    <BookingProgress booking={booking} now={now} />
                  </div>

                  {booking.status === "REJECTED" && booking.rejectionReason && (
                    <div className="alert alert--error font-normal mb-3">
                      <span className="icon icon--20 icon--w500 icon--error" aria-hidden="true">feedback</span>
                      <p>
                        <span className="font-medium">เหตุผลที่ถูกปฏิเสธ: </span>
                        {booking.rejectionReason}
                      </p>
                    </div>
                  )}

                  {booking.description && (
                    <div className="mb-3 px-4 py-3 bg-canvas border border-line rounded-sm text-body-small text-ink-muted">
                      <span className="text-ink-subtle">หมายเหตุ: </span>
                      {booking.description}
                    </div>
                  )}

                  {cancellable && (
                    <button
                      onClick={() => setPendingCancel(booking)}
                      className="btn-outline-error btn--s"
                    >
                      <span className="icon icon--20 icon--w500" aria-hidden="true">event_busy</span>
                      ยกเลิกการจอง
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingCancel}
        title="ยืนยันการยกเลิกการจอง"
        confirmLabel="ยกเลิกการจอง"
        cancelLabel="ไม่ยกเลิก"
        tone="danger"
        busy={isCancelling}
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
      >
        {pendingCancel && (
          <>
            ต้องการยกเลิก <span className="font-medium text-ink">"{pendingCancel.title}"</span>
            <br />
            {formatRange(pendingCancel.startTime, pendingCancel.endTime)} ใช่หรือไม่?
            {pendingCancel.status === "APPROVED" && (
              <span className="flex items-center gap-2 mt-3 text-ink">
                <span className="icon icon--20 icon--w500 text-error" aria-hidden="true">warning</span>
                การจองนี้อนุมัติแล้ว หากยกเลิกต้องจองใหม่
              </span>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
