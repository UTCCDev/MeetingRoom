"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { BOOKING_DECIDED_EVENT } from "@/app/components/NotificationBell";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { formatRange, roomLabel, toDateKey } from "@/lib/format";

interface Booking {
  id: string;
  title: string;
  description?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  room: {
    id: string;
    name: string;
    description?: string;
    capacity: number;
  };
  startTime: string;
  endTime: string;
  attendees: number;
}

const UNDO_MS = 5000;

async function putStatus(id: string, body: object, keepalive = false) {
  const response = await fetch(`/api/bookings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
  }
}

export default function PendingApprovalsPage() {
  const { data: session, status } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [roomFilter, setRoomFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  // Approvals wait UNDO_MS before being sent so "เลิกทำ" can cancel them.
  const pendingApprovals = useRef(new Map<string, { booking: Booking; timer: ReturnType<typeof setTimeout> }>());

  const myId = (session?.user as any)?.id;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (!userRole || !["ROOM_ADMIN", "SYSTEM_ADMIN"].includes(userRole)) {
        router.push("/");
      } else {
        fetchBookings();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Refetch when a request is decided from the notification bell.
  useEffect(() => {
    const onDecided = () => fetchBookings();
    window.addEventListener(BOOKING_DECIDED_EVENT, onDecided);
    return () => window.removeEventListener(BOOKING_DECIDED_EVENT, onDecided);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send queued approvals right away if the admin leaves the page.
  useEffect(() => {
    const flush = () => {
      pendingApprovals.current.forEach(({ timer }, id) => {
        clearTimeout(timer);
        putStatus(id, { status: "APPROVED" }, true).catch(() => {});
      });
      pendingApprovals.current.clear();
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/admin/pending-bookings");
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data);
    } catch (err) {
      setError("ไม่สามารถโหลดรายการคำขอจองได้");
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromList = (ids: string[]) => {
    setBookings((bs) => bs.filter((b) => !ids.includes(b.id)));
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const restore = (booking: Booking) => {
    setBookings((bs) =>
      bs.some((b) => b.id === booking.id)
        ? bs
        : [...bs, booking].sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
  };

  const commitApproval = useCallback(
    async (booking: Booking) => {
      pendingApprovals.current.delete(booking.id);
      try {
        await putStatus(booking.id, { status: "APPROVED" });
      } catch (err) {
        restore(booking);
        toast(`อนุมัติ "${booking.title}" ไม่สำเร็จ: ${(err as Error).message}`, { type: "error" });
      }
    },
    [toast]
  );

  const handleApprove = (booking: Booking) => {
    removeFromList([booking.id]);
    const timer = setTimeout(() => commitApproval(booking), UNDO_MS);
    pendingApprovals.current.set(booking.id, { booking, timer });
    toast(`อนุมัติ "${booking.title}" แล้ว`, {
      type: "success",
      duration: UNDO_MS,
      action: {
        label: "เลิกทำ",
        onClick: () => {
          const entry = pendingApprovals.current.get(booking.id);
          if (!entry) return;
          clearTimeout(entry.timer);
          pendingApprovals.current.delete(booking.id);
          restore(booking);
        },
      },
    });
  };

  const handleReject = async (booking: Booking) => {
    if (!rejectionReason.trim()) {
      setRejectError("กรุณาระบุเหตุผลในการปฏิเสธ");
      return;
    }

    setIsRejecting(true);
    try {
      await putStatus(booking.id, { status: "REJECTED", rejectionReason: rejectionReason.trim() });
      removeFromList([booking.id]);
      setRejectingId(null);
      setRejectionReason("");
      toast(`ปฏิเสธ "${booking.title}" แล้ว`, { type: "success" });
    } catch (err) {
      toast((err as Error).message || "ปฏิเสธการจองไม่สำเร็จ", { type: "error" });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleBulkApprove = async () => {
    const targets = bookings.filter((b) => selected.has(b.id));
    setIsBulkApproving(true);
    const failed: string[] = [];
    for (const b of targets) {
      try {
        await putStatus(b.id, { status: "APPROVED" });
      } catch {
        failed.push(b.id);
      }
    }
    removeFromList(targets.map((b) => b.id).filter((id) => !failed.includes(id)));
    setIsBulkApproving(false);
    setBulkOpen(false);
    const ok = targets.length - failed.length;
    if (failed.length) {
      toast(`อนุมัติสำเร็จ ${ok} รายการ ไม่สำเร็จ ${failed.length} รายการ`, { type: "error" });
    } else {
      toast(`อนุมัติแล้ว ${ok} รายการ`, { type: "success" });
    }
  };

  const rooms = Array.from(new Map(bookings.map((b) => [b.room.id, b.room])).values()).sort((a, b) =>
    roomLabel(a).localeCompare(roomLabel(b), "th")
  );

  const now = new Date();
  const matchesFilters = (b: Booking) =>
    (!roomFilter || b.room.id === roomFilter) &&
    (!dateFilter || toDateKey(b.startTime) === dateFilter);
  // Requests whose meeting already started can't be approved any more.
  const visible = bookings.filter((b) => new Date(b.startTime) > now && matchesFilters(b));
  const expired = bookings
    .filter((b) => new Date(b.startTime) <= now && matchesFilters(b))
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const selectable = visible.filter((b) => b.user.id !== myId);
  const allSelected = selectable.length > 0 && selectable.every((b) => selected.has(b.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="คำขอจองที่รอการตัดสินใจ" breadcrumbs={[{ label: "อนุมัติการจอง" }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--w500 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        {!isLoading && bookings.length > 0 && (
          <div className="card mb-6 flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-auto sm:min-w-[280px]">
              <label htmlFor="filter-room" className="field-label">ห้อง</label>
              <select
                id="filter-room"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="input-field"
              >
                <option value="">ทุกห้อง</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{roomLabel(r)}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label htmlFor="filter-date" className="field-label">วันที่ประชุม</label>
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input-field"
              />
            </div>
            {(roomFilter || dateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setRoomFilter("");
                  setDateFilter("");
                }}
                className="btn-text"
              >
                <span className="icon icon--20 icon--w500" aria-hidden="true">filter_alt_off</span>
                ล้างตัวกรอง
              </button>
            )}
            <div className="ml-auto flex items-center gap-4">
              <label className="flex items-center gap-2 h-11 text-label-large text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(selectable.map((b) => b.id)))
                  }
                  disabled={selectable.length === 0}
                />
                เลือกทั้งหมด
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={selected.size === 0}
                onClick={() => setBulkOpen(true)}
              >
                <span className="icon icon--20 icon--w500" aria-hidden="true">done_all</span>
                อนุมัติที่เลือก ({selected.size})
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={3} />
        ) : visible.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 icon--w300 text-ink-subtle" aria-hidden="true">task_alt</span>
            <p>
              {bookings.length === 0
                ? "ไม่มีคำขอที่รอการตัดสินใจ"
                : visible.length === 0 && expired.length > 0 && !roomFilter && !dateFilter
                ? "ไม่มีคำขอที่รออนุมัติ (มีเฉพาะคำขอที่เลยเวลาแล้วด้านล่าง)"
                : "ไม่มีคำขอที่ตรงกับตัวกรอง"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((booking) => {
              const isOwn = booking.user.id === myId;
              const overCapacity = booking.attendees > booking.room.capacity;
              return (
                <div key={booking.id} className="card">
                  <div className="flex gap-3 items-start mb-4">
                    <input
                      type="checkbox"
                      className="mt-1.5"
                      checked={selected.has(booking.id)}
                      onChange={() => toggle(booking.id)}
                      disabled={isOwn}
                      aria-label={`เลือก ${booking.title}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <h3 className="card__title">{booking.title}</h3>
                        <span className="badge-pending">
                          <span className="icon icon--20 icon--w500" aria-hidden="true">hourglass_top</span>
                          รอการตัดสินใจ
                        </span>
                      </div>
                      <p className="flex items-center gap-2 text-label-large text-ink tabular-nums mt-2">
                        <span className="icon icon--20 icon--w300 text-primary" aria-hidden="true">schedule</span>
                        {formatRange(booking.startTime, booking.endTime)}
                      </p>
                      <p className="flex items-center gap-2 card__body mt-1">
                        <span className="icon icon--20 icon--w300 text-ink-subtle" aria-hidden="true">location_on</span>
                        {roomLabel(booking.room)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 sm:pl-8">
                    <div>
                      <p className="text-label-medium font-normal text-ink-subtle">ผู้ขอ</p>
                      <p className="text-label-large text-ink">{booking.user.name}</p>
                      <p className="text-body-small text-ink-subtle break-all">{booking.user.email}</p>
                    </div>
                    <div>
                      <p className="text-label-medium font-normal text-ink-subtle">จำนวนผู้เข้าร่วม</p>
                      <p className="text-label-large text-ink tabular-nums">
                        {booking.attendees} คน{" "}
                        <span className="text-ink-subtle font-normal">/ ความจุ {booking.room.capacity}</span>
                      </p>
                      {overCapacity && (
                        <span className="badge-booked mt-1">
                          <span className="icon icon--20 icon--w500" aria-hidden="true">warning</span>
                          เกินความจุห้อง {booking.attendees - booking.room.capacity} คน
                        </span>
                      )}
                    </div>
                  </div>

                  {booking.description && (
                    <div className="mb-4 px-4 py-3 bg-canvas border border-line rounded-s sm:ml-8 text-body-small text-ink-muted">
                      <span className="text-ink-subtle">หมายเหตุ: </span>
                      {booking.description}
                    </div>
                  )}

                  {isOwn ? (
                    <p className="flex items-center gap-2 text-body-small text-ink-subtle sm:pl-8">
                      <span className="icon icon--20 icon--w300" aria-hidden="true">info</span>
                      คำขอของคุณเอง — ต้องให้ผู้ดูแลท่านอื่นเป็นผู้อนุมัติ
                    </p>
                  ) : rejectingId === booking.id ? (
                    <div className="p-4 bg-[#FDF1F1] border border-[#F1B8B8] rounded-s sm:ml-8">
                      <label htmlFor={`reason-${booking.id}`} className="field-label">
                        เหตุผลในการปฏิเสธ *
                      </label>
                      <textarea
                        id={`reason-${booking.id}`}
                        value={rejectionReason}
                        onChange={(e) => {
                          setRejectionReason(e.target.value);
                          setRejectError("");
                        }}
                        className={`input-field ${rejectError ? "border-error" : ""}`}
                        aria-invalid={!!rejectError}
                        aria-describedby={`reason-error-${booking.id}`}
                        placeholder="อธิบายว่าทำไมจึงปฏิเสธการจองนี้..."
                        maxLength={500}
                        rows={3}
                        autoFocus
                      />
                      <p id={`reason-error-${booking.id}`} className="field-error min-h-[1.4rem]">
                        {rejectError}
                      </p>
                      {/* Primary action on the right, 12px apart. */}
                      <div className="flex justify-end gap-3 mt-2">
                        <button
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason("");
                            setRejectError("");
                          }}
                          className="btn-text btn--s"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => handleReject(booking)}
                          disabled={isRejecting}
                          className="btn-danger btn--s"
                        >
                          <span className="icon icon--20 icon--w500" aria-hidden="true">block</span>
                          {isRejecting ? "กำลังปฏิเสธ..." : "ยืนยันการปฏิเสธ"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 sm:pl-8">
                      <button onClick={() => handleApprove(booking)} className="btn-primary btn--s">
                        <span className="icon icon--20 icon--w500" aria-hidden="true">check</span>
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(booking.id);
                          setRejectionReason("");
                          setRejectError("");
                        }}
                        className="btn-secondary btn--s text-error hover:border-error hover:bg-[#FDF1F1]"
                      >
                        <span className="icon icon--20 icon--w500" aria-hidden="true">close</span>
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isLoading && expired.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <details className="card">
            <summary className="cursor-pointer text-label-large text-ink-muted">
              คำขอที่เลยเวลาเริ่มประชุมแล้ว ({expired.length}) — อนุมัติไม่ได้
            </summary>
            <ul className="mt-4 divide-y divide-line">
              {expired.map((b) => (
                <li key={b.id} className="py-3 text-body-small text-ink-subtle">
                  <p className="text-label-large text-ink-muted">{b.title}</p>
                  <p className="flex items-center gap-2 tabular-nums">
                    <span className="icon icon--20 icon--w300" aria-hidden="true">schedule</span>
                    {formatRange(b.startTime, b.endTime)}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="icon icon--20 icon--w300" aria-hidden="true">location_on</span>
                    {roomLabel(b.room)} · ผู้ขอ {b.user.name}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <ConfirmDialog
        open={bulkOpen}
        title="อนุมัติคำขอที่เลือก"
        confirmLabel={`อนุมัติ ${selected.size} รายการ`}
        tone="success"
        busy={isBulkApproving}
        onConfirm={handleBulkApprove}
        onCancel={() => setBulkOpen(false)}
      >
        ต้องการอนุมัติคำขอ {selected.size} รายการที่เลือกใช่หรือไม่?
        {bookings.some((b) => selected.has(b.id) && b.attendees > b.room.capacity) && (
          <span className="flex items-center gap-2 mt-3 text-ink">
            <span className="icon icon--20 icon--w500 text-error" aria-hidden="true">warning</span>
            มีบางรายการที่จำนวนผู้เข้าร่วมเกินความจุห้อง
          </span>
        )}
      </ConfirmDialog>
    </div>
  );
}
