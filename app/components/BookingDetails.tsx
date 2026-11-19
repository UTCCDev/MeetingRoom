"use client";

import { useEffect, useState, type ReactNode } from "react";
import BookingProgress from "@/app/components/BookingProgress";
import { formatDate, formatRange, roomLabel, STATUS_BADGE, STATUS_ICONS, STATUS_LABELS } from "@/lib/format";

interface Person {
  id: string;
  name: string;
  email?: string;
}

export interface BookingDetail {
  id: string;
  title: string;
  description?: string | null;
  room: { id: string; name: string; description?: string | null };
  startTime: string;
  endTime: string;
  status: string;
  attendees: number;
  rejectionReason?: string | null;
  decisionNote?: string | null;
  createdAt?: string;
  user?: Person;
  bookedFor?: Person | null;
  department?: { name: string } | null;
  approvedBy?: Person | null;
}

/** Loads one booking. The API answers 404 for bookings the user may not see. */
export function useBookingDetail(id: string | null) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBooking(null);
    setError("");
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/bookings/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) setBooking(data);
        else setError(res.status === 404 ? "ไม่พบการจองนี้ หรือคุณไม่มีสิทธิ์ดูรายละเอียด" : data.error || "โหลดข้อมูลไม่สำเร็จ");
      })
      .catch(() => alive && setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  return { booking, error, loading };
}

const row = (icon: string, content: ReactNode) => (
  <p className="flex items-start gap-2 card__body mt-1">
    <span className="icon icon--20 text-ink-subtle" aria-hidden="true">{icon}</span>
    <span className="min-w-0 break-words">{content}</span>
  </p>
);

export function BookingDetailBody({ booking, titleId }: { booking: BookingDetail; titleId?: string }) {
  return (
    <>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
        <h2 id={titleId} className="card__title text-ink flex-1 min-w-0 break-words">{booking.title}</h2>
        <span className={STATUS_BADGE[booking.status] || "badge-neutral"}>
          <span className="icon icon--20" aria-hidden="true">{STATUS_ICONS[booking.status] || "info"}</span>
          {STATUS_LABELS[booking.status] || booking.status}
        </span>
      </div>

      <p className="flex items-center gap-2 text-title-small text-ink tabular-nums">
        <span className="icon icon--20 text-primary" aria-hidden="true">schedule</span>
        {formatRange(booking.startTime, booking.endTime)}
      </p>
      {row("location_on", roomLabel(booking.room))}
      {row("group", <><span className="tabular-nums">{booking.attendees}</span> คน</>)}
      {booking.user && row("person", `ผู้จอง: ${booking.user.name}`)}
      {booking.department && row("apartment", `หน่วยงาน: ${booking.department.name}`)}
      {booking.bookedFor && row("person_add", `ผู้ประสานงาน: ${booking.bookedFor.name}`)}
      {booking.approvedBy && row("verified", `ผู้อนุมัติ: ${booking.approvedBy.name}`)}
      {booking.createdAt && row("history", `จองเมื่อ ${formatDate(booking.createdAt)}`)}

      {booking.description && (
        <div className="mt-4 p-3 rounded-sm bg-surface-variant/50 text-body-medium text-ink whitespace-pre-wrap break-words">
          {booking.description}
        </div>
      )}

      <div className="my-5 py-4 border-y border-line">
        <BookingProgress booking={booking} now={new Date()} />
      </div>

      {booking.status === "REJECTED" && booking.rejectionReason && (
        <div className="alert alert--error font-normal mb-3">
          <span className="icon icon--20 icon--error" aria-hidden="true">feedback</span>
          <p>
            <span className="font-medium">เหตุผลที่ถูกปฏิเสธ: </span>
            {booking.rejectionReason}
          </p>
        </div>
      )}
      {booking.decisionNote && row("sticky_note_2", `หมายเหตุผู้อนุมัติ: ${booking.decisionNote}`)}
    </>
  );
}

/** Popup with a booking's details, opened from the room calendar so the user stays on the page. */
export function BookingDetailDialog({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const { booking, error, loading } = useBookingDetail(bookingId);

  useEffect(() => {
    if (!bookingId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookingId, onClose]);

  if (!bookingId) return null;

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
        className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icon-button absolute top-3 right-3" onClick={onClose} aria-label="ปิด" autoFocus>
          <span className="icon icon--24" aria-hidden="true">close</span>
        </button>
        <div className="pr-10">
          {loading ? (
            <p className="text-body-medium text-ink-subtle py-8 text-center">กำลังโหลด…</p>
          ) : error || !booking ? (
            <p id="booking-detail-title" className="flex items-center gap-2 text-body-medium text-ink-muted py-6">
              <span className="icon icon--24 text-ink-subtle" aria-hidden="true">event_busy</span>
              {error}
            </p>
          ) : (
            <BookingDetailBody booking={booking} titleId="booking-detail-title" />
          )}
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
