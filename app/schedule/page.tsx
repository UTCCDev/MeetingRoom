"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Dropdown from "@/app/components/Dropdown";
import DatePicker from "@/app/components/DatePicker";
import { SkeletonCards } from "@/app/components/Skeleton";
import { addDays, formatDate, formatTime, roomLocation, roomTitle, STATUS_BADGE, STATUS_ICONS, STATUS_LABELS, todayKey } from "@/lib/format";

interface Person {
  id: string;
  name: string;
  email?: string;
}

interface ScheduleBooking {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  attendees: number;
  user?: Person | null;
  bookedFor?: Person | null;
  department?: { name: string } | null;
}

interface ScheduleRoom {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  capacity: number;
  building: string;
  floor: string;
  bookings: ScheduleBooking[];
}

// Each housekeeper looks after the same floors every day, so remember the last pick on this device.
const PREF_KEY = "schedule-filter";
const ALL = "";
const NO_VALUE = "-";

// Buildings without a number in the room code: code "00" is the maintenance building.
const BUILDING_NAMES: Record<string, string> = { "0": "อาคารซ่อมบำรุง" };
const buildingLabel = (b: string) => (b === NO_VALUE ? "ไม่ระบุอาคาร" : BUILDING_NAMES[b] ?? `อาคาร ${b}`);

const byNumber = (a: string, b: string) => a.localeCompare(b, "th", { numeric: true });

/** Ids of bookings in the room that overlap another booking in the same room. */
function clashIds(bookings: ScheduleBooking[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];
      if (new Date(a.startTime) < new Date(b.endTime) && new Date(b.startTime) < new Date(a.endTime)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

export default function SchedulePage() {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [building, setBuilding] = useState(ALL);
  const [floor, setFloor] = useState(ALL);
  const [rooms, setRooms] = useState<ScheduleRoom[]>([]);
  const [places, setPlaces] = useState<{ building: string; floor: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      if (typeof saved.building === "string") setBuilding(saved.building);
      if (typeof saved.floor === "string") setFloor(saved.floor);
    } catch {}
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ building, floor }));
    } catch {}
  }, [building, floor]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/schedule?date=${date}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && Array.isArray(data?.rooms)) {
          setRooms(data.rooms);
          setPlaces(Array.isArray(data.places) ? data.places : []);
        }
        else setError(data?.error || "โหลดข้อมูลไม่สำเร็จ");
      })
      .catch(() => alive && setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date]);

  const buildings = useMemo(
    () => [...new Set(places.map((r) => r.building || NO_VALUE))].sort(byNumber),
    [places]
  );
  const floors = useMemo(
    () =>
      [...new Set(places.filter((r) => building === ALL || (r.building || NO_VALUE) === building).map((r) => r.floor || NO_VALUE))].sort(
        byNumber
      ),
    [places, building]
  );

  const visible = rooms.filter(
    (r) =>
      (building === ALL || (r.building || NO_VALUE) === building) &&
      (floor === ALL || (r.floor || NO_VALUE) === floor)
  );

  // Group: building → floor → rooms.
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleRoom[]>();
    for (const r of visible) {
      const key = `${r.building || NO_VALUE}|${r.floor || NO_VALUE}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()]
      .map(([key, list]) => {
        const [b, f] = key.split("|");
        return { building: b, floor: f, rooms: list };
      })
      .sort((x, y) => byNumber(x.building, y.building) || byNumber(x.floor, y.floor));
  }, [visible]);

  const totalBookings = visible.reduce((n, r) => n + r.bookings.length, 0);
  const totalClashes = visible.reduce((n, r) => n + clashIds(r.bookings).size, 0);

  const placeLabel = (b: string, f: string) =>
    `${buildingLabel(b)} · ${f === NO_VALUE ? "ไม่ระบุชั้น" : `ชั้น ${f}`}`;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Standalone page: shared by link with staff who have no account, so no app menu. */}
      <header className="bg-white border-b border-line">
        <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <span className="icon-tile bg-primary text-on-primary" aria-hidden="true">
            <span className="icon icon--20 icon--filled">calendar_view_day</span>
          </span>
          <h1 className="text-title-large text-primary">สรุปการใช้ห้อง</h1>
          <Link href="/" className="btn-secondary btn--s ml-auto">
            <span className="icon icon--20" aria-hidden="true">home</span>
            หน้าแรก
          </Link>
        </div>
      </header>

      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <p className="text-body-medium text-ink-muted">
          ตรวจดูว่าห้องถูกใช้งานตรงตามการจองหรือไม่ เลือกอาคารและชั้นที่รับผิดชอบ ระบบจะจำตัวเลือกไว้ในเครื่องนี้
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="schedule-date" className="field-label">วันที่</label>
            <div className="flex items-center gap-1">
              <button type="button" className="icon-button flex-none" onClick={() => setDate(addDays(date, -1))} aria-label="วันก่อนหน้า">
                <span className="icon icon--24" aria-hidden="true">chevron_left</span>
              </button>
              <div className="flex-1 min-w-0">
                <DatePicker id="schedule-date" value={date} onChange={setDate} />
              </div>
              <button type="button" className="icon-button flex-none" onClick={() => setDate(addDays(date, 1))} aria-label="วันถัดไป">
                <span className="icon icon--24" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="schedule-building" className="field-label">อาคาร</label>
            <Dropdown
              id="schedule-building"
              value={building}
              onChange={(v) => {
                setBuilding(v);
                setFloor(ALL);
              }}
              options={[
                { value: ALL, label: "ทุกอาคาร" },
                ...buildings.map((b) => ({ value: b, label: buildingLabel(b) })),
              ]}
              placeholder="ทุกอาคาร"
              searchPlaceholder="ค้นหาอาคาร"
            />
          </div>
          <div>
            <label htmlFor="schedule-floor" className="field-label">ชั้น</label>
            <Dropdown
              id="schedule-floor"
              value={floor}
              onChange={setFloor}
              options={[
                { value: ALL, label: "ทุกชั้น" },
                ...floors.map((f) => ({ value: f, label: f === NO_VALUE ? "ไม่ระบุชั้น" : `ชั้น ${f}` })),
              ]}
              placeholder="ทุกชั้น"
              searchPlaceholder="ค้นหาชั้น"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {date !== today && (
              <button type="button" className="btn-secondary" onClick={() => setDate(today)}>
                <span className="icon icon--20" aria-hidden="true">today</span>
                วันนี้
              </button>
            )}
          </div>
        </div>

        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body-medium text-ink-muted" aria-live="polite">
            <span className="flex items-center gap-1">
              <span className="icon icon--20" aria-hidden="true">event</span>
              {formatDate(`${date}T00:00:00+07:00`)}
            </span>
            <span>{visible.length} ห้อง · {totalBookings} การจอง</span>
            {totalClashes > 0 && (
              <span className="flex items-center gap-1 text-error font-medium">
                <span className="icon icon--20" aria-hidden="true">warning</span>
                มีการจองเวลาทับกัน {totalClashes} รายการ
              </span>
            )}
          </div>
        )}

        {loading ? (
          <SkeletonCards count={3} />
        ) : error ? (
          <div className="alert alert--error">
            <span className="icon icon--20 icon--error" aria-hidden="true">error</span>
            <p>{error}</p>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-body-medium text-ink-subtle py-12 text-center">ไม่มีการจองในวันนี้ตามอาคารและชั้นที่เลือก</p>
        ) : (
          groups.map((g) => (
            <section key={`${g.building}|${g.floor}`} aria-label={placeLabel(g.building, g.floor)} className="space-y-3">
              <h2 className="flex items-center gap-2 text-title-large text-ink">
                <span className="icon icon--24 text-primary" aria-hidden="true">domain</span>
                {placeLabel(g.building, g.floor)}
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {g.rooms.map((room) => {
                  const clashes = clashIds(room.bookings);
                  return (
                    <article key={room.id} className="rounded-xl border border-line bg-white overflow-hidden">
                      <header className="px-4 py-3 border-b border-line bg-surface-variant/40">
                        <h3 className="text-title-medium text-ink">{roomTitle(room)}</h3>
                        <p className="text-body-small text-ink-muted">
                          {roomLocation(room.description) || "-"} · {room.capacity} ที่นั่ง
                        </p>
                      </header>
<ul className="divide-y divide-line">
                          {room.bookings.map((b) => {
                            const start = new Date(b.startTime).getTime();
                            const end = new Date(b.endTime).getTime();
                            const live = start <= now && now < end;
                            const past = end <= now;
                            const clash = clashes.has(b.id);
                            return (
                              <li
                                key={b.id}
                                className={`px-4 py-3 flex gap-4 ${clash ? "bg-error-90/40" : live ? "bg-primary-container/40" : ""} ${past ? "opacity-60" : ""}`}
                              >
                                <div className="flex-none w-24 tabular-nums">
                                  <p className="text-title-small text-ink">{formatTime(b.startTime)}–{formatTime(b.endTime)}</p>
                                  {live && <p className="text-label-large text-primary font-medium">กำลังใช้งาน</p>}
                                  {past && <p className="text-label-large text-ink-subtle">ผ่านไปแล้ว</p>}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-title-small text-ink break-words">{b.title}</p>
                                    <span className={STATUS_BADGE[b.status] || "badge-neutral"}>
                                      <span className="icon icon--20" aria-hidden="true">{STATUS_ICONS[b.status]}</span>
                                      {STATUS_LABELS[b.status] ?? b.status}
                                    </span>
                                    {clash && (
                                      <span className="flex items-center gap-1 text-label-large text-error font-medium">
                                        <span className="icon icon--20" aria-hidden="true">warning</span>
                                        เวลาทับกัน
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-body-small text-ink-muted flex items-center gap-1">
                                    <span className="icon icon--20" aria-hidden="true">person</span>
                                    ผู้จอง: {b.user?.name ?? "-"}
                                    {b.department?.name && <> · {b.department.name}</>}
                                  </p>
                                  {b.bookedFor && (
                                    <p className="text-body-small text-ink-muted flex items-center gap-1">
                                      <span className="icon icon--20" aria-hidden="true">person_add</span>
                                      ผู้ประสานงาน: {b.bookedFor.name}
                                    </p>
                                  )}
                                  {b.attendees > 0 && (
                                    <p className="text-body-small text-ink-muted flex items-center gap-1">
                                      <span className="icon icon--20" aria-hidden="true">groups</span>
                                      {b.attendees} คน
                                    </p>
                                  )}
                                  {b.description && (
                                    <p className="text-body-small text-ink-muted whitespace-pre-line break-words">{b.description}</p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
