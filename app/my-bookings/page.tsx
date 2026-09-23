"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { formatRange, roomLabel, STATUS_LABELS } from "@/lib/format";

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
}

// Left colour strip per status, so the list can be scanned at a glance.
const STATUS_STRIP: Record<string, string> = {
  APPROVED: "border-l-emerald-500",
  PENDING: "border-l-amber-400",
  REJECTED: "border-l-rose-500",
  CANCELLED: "border-l-gray-400",
};

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

const STATUS_CLASS: Record<string, string> = {
  APPROVED: "badge-available",
  PENDING: "badge-pending",
  REJECTED: "badge-booked",
  CANCELLED: "inline-block px-3 py-1 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full",
};

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

  // Upcoming: soonest meeting first. History: most recent first.
  const visible = bookings
    .filter((b) => (tab === "upcoming" ? isUpcoming(b) : !isUpcoming(b)))
    .filter((b) => filter === "ALL" || b.status === filter)
    .sort((a, b) => {
      const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return tab === "upcoming" ? diff : -diff;
    });

  const upcomingCount = bookings.filter(isUpcoming).length;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="การจองของฉัน" breadcrumbs={[{ label: "การจองของฉัน" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex border-b border-gray-200 mb-6" role="tablist">
          {[
            { value: "upcoming" as const, label: `กำลังจะมาถึง (${upcomingCount})` },
            { value: "history" as const, label: `ประวัติ (${bookings.length - upcomingCount})` },
          ].map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => {
                setTab(t.value);
                setFilter("ALL");
              }}
              className={`px-4 py-3 font-medium -mb-px border-b-2 ${
                tab === t.value ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {["ALL", ...tabStatuses].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                filter === value
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {value === "ALL" ? "ทั้งหมด" : STATUS_LABELS[value]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-100 text-rose-700 rounded-lg" role="alert">
            ⚠️ {error}
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={3} />
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-6">
              {bookings.length === 0
                ? "คุณยังไม่มีการจองใดๆ"
                : filter !== "ALL"
                ? "ไม่มีการจองที่ตรงกับตัวกรองที่เลือก"
                : tab === "upcoming"
                ? "ไม่มีการประชุมที่กำลังจะมาถึง"
                : "ยังไม่มีประวัติการจอง"}
            </p>
            <Link href="/rooms" className="btn-primary inline-block">
              ค้นหาห้องประชุม →
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
                  className={`card border-l-4 ${STATUS_STRIP[booking.status] || "border-l-gray-300"} ${
                    muted ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-xl font-bold mb-1 ${muted ? "text-gray-600" : "text-blue-700"}`}>
                        {booking.title}
                      </h3>
                      <p className="text-gray-800 font-medium">🕘 {formatRange(booking.startTime, booking.endTime)}</p>
                      <p className="text-gray-600 text-sm mt-1">📍 {roomLabel(booking.room)}</p>
                      <p className="text-gray-600 text-sm">👥 {booking.attendees} คน</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={STATUS_CLASS[booking.status] || "badge-booked"}>
                        {STATUS_LABELS[booking.status] || booking.status}
                      </span>
                      {countdown && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            countdown.urgent ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          ⏱ {countdown.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {booking.status === "REJECTED" && booking.rejectionReason && (
                    <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded text-sm">
                      <span className="font-medium text-rose-700">เหตุผลที่ถูกปฏิเสธ: </span>
                      {booking.rejectionReason}
                    </div>
                  )}

                  {booking.description && (
                    <div className="mb-3 p-3 bg-gray-100 rounded text-sm">
                      <span className="text-gray-600">หมายเหตุ: </span>
                      {booking.description}
                    </div>
                  )}

                  {cancellable && (
                    <button
                      onClick={() => setPendingCancel(booking)}
                      className="btn-danger text-sm px-4 py-2"
                    >
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
            ต้องการยกเลิก <span className="font-semibold">"{pendingCancel.title}"</span>
            <br />
            {formatRange(pendingCancel.startTime, pendingCancel.endTime)} ใช่หรือไม่?
            {pendingCancel.status === "APPROVED" && (
              <span className="block mt-2 text-sm text-amber-700">การจองนี้อนุมัติแล้ว หากยกเลิกต้องจองใหม่</span>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
