"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import Dropdown from "@/app/components/Dropdown";
import DatePicker from "@/app/components/DatePicker";
import { SkeletonCards } from "@/app/components/Skeleton";
import Pagination, { usePagination } from "@/app/components/Pagination";
import { addDays, formatRange, STATUS_BADGE, STATUS_LABELS, todayKey } from "@/lib/format";
import { roomPlace } from "@/lib/room-code";

type Person = { id: string; name: string; email: string; department?: { name: string } | null };

interface Booking {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  attendees: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  rejectionReason?: string | null;
  room: { id: string; code: string | null; name: string; description: string | null; capacity: number };
  user: Person;
  bookedFor?: Person | null;
  approvedBy?: { name: string } | null;
  department?: { name: string } | null;
}

const PAGE_SIZE = 20;

const personText = (p: Person) => (p.department?.name ? `${p.name} (${p.department.name})` : p.name);

function placeText(room: Booking["room"]): string {
  const { building, floor } = roomPlace(room);
  return [building && `อาคาร ${building}`, floor && `ชั้น ${floor}`].filter(Boolean).join(" ");
}

export default function BookingHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const role = (session?.user as any)?.role as string | undefined;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => addDays(todayKey(), -30));
  const [to, setTo] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated" && role === "USER") {
      router.push("/");
    }
  }, [status, role, router, pathname]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/admin/bookings?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "โหลดประวัติการจองไม่สำเร็จ");
      setBookings(data.bookings);
      setTruncated(!!data.truncated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (status === "authenticated" && role !== "USER") load();
  }, [status, role, load]);

  const rooms = useMemo(() => {
    const map = new Map<string, Booking["room"]>();
    bookings.forEach((b) => map.set(b.room.id, b.room));
    return [...map.values()].sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name));
  }, [bookings]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter(
      (b) =>
        (!roomFilter || b.room.id === roomFilter) &&
        (!statusFilter || b.status === statusFilter) &&
        (!q ||
          [b.title, b.user.name, b.user.email, b.bookedFor?.name, b.department?.name, b.user.department?.name]
            .filter(Boolean)
            .some((s) => s!.toLowerCase().includes(q)))
    );
  }, [bookings, roomFilter, statusFilter, query]);

  const { listRef, page, pageCount, setPage, pageItems, from: shownFrom, to: shownTo } = usePagination(
    shown,
    PAGE_SIZE,
    `${roomFilter}|${statusFilter}|${query}|${from}|${to}`
  );

  const filtered = roomFilter || statusFilter || query;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="ประวัติการจอง" breadcrumbs={[{ label: "ประวัติการจอง" }]} />

      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-body-medium text-ink-muted mb-6">
          {role === "SYSTEM_ADMIN" ? "การจองทุกห้องในระบบ" : "การจองของห้องที่คุณดูแลหรือเป็นผู้อนุมัติ"} เรียงจากวันประชุมล่าสุด
        </p>

        <div className="card mb-6 flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-44">
            <label htmlFor="filter-from" className="field-label">ตั้งแต่วันที่</label>
            <DatePicker id="filter-from" value={from} onChange={setFrom} placeholder="ย้อนหลัง 90 วัน" clearable />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="filter-to" className="field-label">ถึงวันที่</label>
            <DatePicker id="filter-to" value={to} onChange={setTo} min={from || undefined} placeholder="ล่วงหน้า 1 ปี" clearable />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[260px]">
            <label htmlFor="filter-room" className="field-label">ห้อง</label>
            <Dropdown
              id="filter-room"
              value={roomFilter}
              onChange={setRoomFilter}
              options={[
                { value: "", label: "ทุกห้อง" },
                ...rooms.map((r) => ({ value: r.id, label: r.code ? `${r.name} (${r.code})` : r.name, hint: placeText(r) })),
              ]}
              searchPlaceholder="ค้นหาห้อง"
            />
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="filter-status" className="field-label">สถานะ</label>
            <Dropdown
              id="filter-status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "", label: "ทุกสถานะ" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
              searchable={false}
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[220px]">
            <label htmlFor="filter-q" className="field-label">ค้นหา</label>
            <input
              id="filter-q"
              type="search"
              className="input-field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="หัวข้อ, ชื่อผู้จอง, หน่วยงาน"
            />
          </div>
          {filtered && (
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setRoomFilter("");
                setStatusFilter("");
                setQuery("");
              }}
            >
              <span className="icon icon--20" aria-hidden="true">filter_alt_off</span>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}
        {truncated && (
          <div className="alert mb-4" role="status">
            <span className="icon icon--24" aria-hidden="true">info</span>
            แสดง 2,000 รายการล่าสุดเท่านั้น กรุณาเลือกช่วงวันที่ให้แคบลง
          </div>
        )}

        {isLoading ? (
          <SkeletonCards count={4} className="space-y-4" />
        ) : shown.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 text-ink-subtle" aria-hidden="true">event_busy</span>
            <p>ไม่พบการจองในช่วงนี้</p>
          </div>
        ) : (
          <div ref={listRef} className="scroll-mt-24">
            <ul className="space-y-3">
              {pageItems.map((b) => (
                <li key={b.id} className="card">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-title-medium text-ink break-words">{b.title}</p>
                      <p className="flex items-center gap-1 mt-1 text-body-small text-ink-muted">
                        <span className="icon icon--20 text-ink-subtle" aria-hidden="true">meeting_room</span>
                        {b.room.name}
                        {b.room.code && <span className="tabular-nums"> ({b.room.code})</span>}
                        {placeText(b.room) && ` · ${placeText(b.room)}`}
                      </p>
                    </div>
                    <span className={STATUS_BADGE[b.status] || "badge-neutral"}>{STATUS_LABELS[b.status] || b.status}</span>
                  </div>

                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-body-small">
                    <div className="flex gap-2">
                      <dt className="text-ink-subtle flex-none">เวลา</dt>
                      <dd className="text-ink tabular-nums">{formatRange(b.startTime, b.endTime)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ink-subtle flex-none">ผู้จอง</dt>
                      <dd className="text-ink">{personText(b.user)}</dd>
                    </div>
                    {b.bookedFor && (
                      <div className="flex gap-2">
                        <dt className="text-ink-subtle flex-none">จองให้</dt>
                        <dd className="text-ink">{personText(b.bookedFor)}</dd>
                      </div>
                    )}
                    {b.department && (
                      <div className="flex gap-2">
                        <dt className="text-ink-subtle flex-none">สำหรับหน่วยงาน</dt>
                        <dd className="text-ink">{b.department.name}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="text-ink-subtle flex-none">ผู้เข้าร่วม</dt>
                      <dd className="text-ink tabular-nums">{b.attendees}/{b.room.capacity}</dd>
                    </div>
                    {b.approvedBy && (b.status === "APPROVED" || b.status === "REJECTED") && (
                      <div className="flex gap-2">
                        <dt className="text-ink-subtle flex-none">{b.status === "APPROVED" ? "อนุมัติโดย" : "ปฏิเสธโดย"}</dt>
                        <dd className="text-ink">{b.approvedBy.name}</dd>
                      </div>
                    )}
                  </dl>
                  {b.status === "REJECTED" && b.rejectionReason && (
                    <p className="mt-2 text-body-small text-on-error-container">เหตุผล: {b.rejectionReason}</p>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-6"
              page={page}
              pageCount={pageCount}
              onChange={setPage}
              from={shownFrom}
              to={shownTo}
              total={shown.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}
