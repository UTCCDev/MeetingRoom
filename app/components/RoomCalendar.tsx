"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, bangkokISO, formatTime, TIME_SLOTS, todayKey } from "@/lib/format";

export interface CalendarBooking {
  id: string;
  title?: string | null;
  startTime: string;
  endTime: string;
  status: string;
}

interface Props {
  bookings: CalendarBooking[];
  selectedDate: string;
  maxDate: string;
  onPickDate: (date: string) => void;
  onPickSlot: (date: string, time: string) => void;
}

type View = "week" | "month";

// Bookable window, same as TIME_SLOTS (07:00–22:00).
const DAY_FROM = "07:00";
const DAY_TO = "22:00";
const FIRST_HOUR = 7;
const HOURS = Array.from({ length: 22 - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
const HOUR_PX = 56;
const WEEKDAY_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

const monthLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });

const keyDate = (key: string) => new Date(`${key}T00:00:00Z`);
/** 0 = Monday … 6 = Sunday (weeks start on Monday). */
const weekdayIndex = (key: string) => (keyDate(key).getUTCDay() + 6) % 7;
const startOfWeek = (key: string) => addDays(key, -weekdayIndex(key));
const startOfMonth = (key: string) => `${key.slice(0, 8)}01`;
const addMonths = (key: string, n: number) => {
  const d = keyDate(startOfMonth(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/** Minutes still free on `day` inside 07:00–22:00, ignoring time that has already passed. */
function freeMinutes(day: string, bookings: CalendarBooking[], now: number): number {
  const from = Math.max(new Date(bangkokISO(day, DAY_FROM)).getTime(), now);
  const to = new Date(bangkokISO(day, DAY_TO)).getTime();
  if (from >= to) return 0;
  const busy = bookings
    .map((b) => [Math.max(new Date(b.startTime).getTime(), from), Math.min(new Date(b.endTime).getTime(), to)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let taken = 0;
  let cursor = from;
  for (const [s, e] of busy) {
    if (e <= cursor) continue;
    taken += e - Math.max(s, cursor);
    cursor = e;
  }
  return Math.round((to - from - taken) / 60000);
}

function hoursLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} ชม.`, m && `${m} นาที`].filter(Boolean).join(" ");
}

export default function RoomCalendar({ bookings, selectedDate, maxDate, onPickDate, onPickSlot }: Props) {
  const today = todayKey();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(selectedDate);
  // Re-render every minute so the "now" line and past shading stay current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Follow the booking form's date when it moves outside the visible range.
  useEffect(() => setCursor(selectedDate), [selectedDate]);

  const bookingsOn = useMemo(() => {
    const cache = new Map<string, CalendarBooking[]>();
    return (day: string) => {
      if (!cache.has(day)) {
        const s = new Date(bangkokISO(day, "00:00")).getTime();
        const e = s + 24 * 3600 * 1000;
        cache.set(
          day,
          bookings.filter((b) => new Date(b.startTime).getTime() < e && new Date(b.endTime).getTime() > s)
        );
      }
      return cache.get(day)!;
    };
  }, [bookings]);

  const weekStart = startOfWeek(cursor);
  const monthStart = startOfMonth(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const canPrev = view === "week" ? weekStart > today : monthStart > startOfMonth(today);
  const canNext = view === "week" ? addDays(weekStart, 7) <= maxDate : addMonths(cursor, 1) <= maxDate;
  const move = (dir: 1 | -1) =>
    setCursor(view === "week" ? addDays(weekStart, dir * 7) : addMonths(cursor, dir));

  const rangeLabel =
    view === "week"
      ? `${shortDate.format(keyDate(weekDays[0]))} – ${shortDate.format(keyDate(weekDays[6]))} ${monthLabel
          .format(keyDate(weekDays[6]))
          .split(" ")
          .slice(-1)}`
      : monthLabel.format(keyDate(monthStart));

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-headline-small text-ink">
          <span className="icon icon--24 text-primary" aria-hidden="true">date_range</span>
          ปฏิทินห้อง
        </h2>
        <div className="chip-group" role="group" aria-label="มุมมองปฏิทิน">
          {(
            [
              { value: "week", label: "สัปดาห์", icon: "view_week" },
              { value: "month", label: "เดือน", icon: "calendar_view_month" },
            ] as const
          ).map((v) => (
            <button key={v.value} type="button" className="chip" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
              <span className="icon" aria-hidden="true">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          className="btn-secondary h-10 px-4"
          onClick={() => setCursor(today)}
          disabled={view === "week" ? weekDays.includes(today) : monthStart === startOfMonth(today)}
        >
          <span className="icon icon--20" aria-hidden="true">today</span>
          วันนี้
        </button>
        <button type="button" className="icon-button" onClick={() => move(-1)} disabled={!canPrev} aria-label="ก่อนหน้า">
          <span className="icon icon--24" aria-hidden="true">chevron_left</span>
        </button>
        <button type="button" className="icon-button" onClick={() => move(1)} disabled={!canNext} aria-label="ถัดไป">
          <span className="icon icon--24" aria-hidden="true">chevron_right</span>
        </button>
        <span className="text-title-medium text-ink" aria-live="polite">{rangeLabel}</span>
      </div>

      {view === "week" ? (
        <WeekGrid
          days={weekDays}
          today={today}
          maxDate={maxDate}
          selectedDate={selectedDate}
          now={now}
          bookingsOn={bookingsOn}
          onPickDate={onPickDate}
          onPickSlot={onPickSlot}
        />
      ) : (
        <MonthGrid
          monthStart={monthStart}
          today={today}
          maxDate={maxDate}
          selectedDate={selectedDate}
          now={now}
          bookingsOn={bookingsOn}
          onPickDate={onPickDate}
        />
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-body-small text-ink-subtle">
        <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-success-95 border border-success-80" /> ว่าง</span>
        <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-primary-container border-l-4 border-primary" /> อนุมัติแล้ว</span>
        <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-highlight-container border-l-4 border-highlight" /> รอการตัดสินใจ</span>
        <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-xs bg-surface-variant" /> เลยเวลาแล้ว</span>
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  today,
  maxDate,
  selectedDate,
  now,
  bookingsOn,
  onPickDate,
  onPickSlot,
}: {
  days: string[];
  today: string;
  maxDate: string;
  selectedDate: string;
  now: number;
  bookingsOn: (day: string) => CalendarBooking[];
  onPickDate: (date: string) => void;
  onPickSlot: (date: string, time: string) => void;
}) {
  const minutesFromTop = (iso: string | number, day: string) =>
    (new Date(iso).getTime() - new Date(bangkokISO(day, DAY_FROM)).getTime()) / 60000;
  const totalMins = HOURS.length * 60;

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="min-w-[46rem] px-4 sm:px-0">
        {/* Day headers */}
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line">
          <div />
          {days.map((day, i) => {
            const isToday = day === today;
            const selectable = day >= today && day <= maxDate;
            const free = selectable ? freeMinutes(day, bookingsOn(day), now) : 0;
            return (
              <button
                key={day}
                type="button"
                disabled={!selectable}
                onClick={() => onPickDate(day)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-t-sm transition-colors enabled:hover:bg-primary-99 ${
                  day === selectedDate ? "bg-primary-95" : ""
                }`}
                aria-label={`ดูตารางวันที่ ${day}`}
              >
                <span className={`text-label-medium ${isToday ? "text-primary" : "text-ink-subtle"}`}>{WEEKDAY_SHORT[i]}</span>
                <span
                  className={`w-9 h-9 flex items-center justify-center rounded-full text-title-medium tabular-nums ${
                    isToday ? "bg-primary text-on-primary" : selectable ? "text-ink" : "text-disabled-fg"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                <span className={`text-label-small ${!selectable ? "text-disabled-fg" : free ? "text-success" : "text-error"}`}>
                  {!selectable ? "–" : free ? `ว่าง ${hoursLabel(free)}` : "เต็ม"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="max-h-[36rem] overflow-y-auto">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] relative" style={{ height: HOURS.length * HOUR_PX }}>
            <div className="relative">
              {HOURS.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-label-small text-ink-subtle tabular-nums"
                  style={{ top: i * HOUR_PX }}
                >
                  {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>

            {days.map((day) => {
              const dayBookings = bookingsOn(day);
              const nowTop = minutesFromTop(now, day);
              const showNow = day === today && nowTop >= 0 && nowTop <= totalMins;
              return (
                <div key={day} className={`relative border-l border-line ${day === selectedDate ? "bg-primary-99" : ""}`}>
                  {/* Half-hour cells: free ones are clickable to start a booking there. */}
                  {TIME_SLOTS.map((slot) => {
                    const start = new Date(bangkokISO(day, slot)).getTime();
                    const past = start <= now || day > maxDate;
                    const end = start + 30 * 60000;
                    const busy = dayBookings.some(
                      (b) => new Date(b.startTime).getTime() < end && new Date(b.endTime).getTime() > start
                    );
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={past || busy}
                        onClick={() => onPickSlot(day, slot)}
                        className={`block w-full border-line ${slot.endsWith(":00") ? "border-t" : "border-t border-dashed border-t-line/60"} ${
                          past ? "bg-surface-variant/70 cursor-not-allowed" : busy ? "cursor-default" : "hover:bg-success-95 focus-visible:bg-success-95"
                        }`}
                        style={{ height: HOUR_PX / 2 }}
                        aria-label={`${day} ${slot} ${past ? "เลยเวลาแล้ว" : busy ? "ไม่ว่าง" : "ว่าง คลิกเพื่อจอง"}`}
                        title={past || busy ? undefined : `จอง ${slot}`}
                      />
                    );
                  })}

                  {dayBookings.map((b) => {
                    const top = Math.max(0, minutesFromTop(b.startTime, day));
                    const bottom = Math.min(totalMins, minutesFromTop(b.endTime, day));
                    if (bottom <= top) return null;
                    const approved = b.status === "APPROVED";
                    const height = ((bottom - top) / 60) * HOUR_PX;
                    return (
                      <div
                        key={b.id}
                        className={`absolute left-1 right-1 rounded-xs border-l-4 px-1.5 py-0.5 overflow-hidden pointer-events-none ${
                          approved
                            ? "bg-primary-container border-primary text-on-primary-container"
                            : "bg-highlight-container border-highlight text-on-highlight-container"
                        }`}
                        style={{ top: (top / 60) * HOUR_PX + 1, height: height - 2 }}
                        title={`${formatTime(b.startTime)}–${formatTime(b.endTime)} ${b.title || "มีการจองแล้ว"}`}
                      >
                        <p className="text-label-small tabular-nums leading-tight">
                          {formatTime(b.startTime)}–{formatTime(b.endTime)}
                        </p>
                        {height > 36 && (
                          <p className="text-label-small font-normal leading-tight truncate">{b.title || "มีการจองแล้ว"}</p>
                        )}
                      </div>
                    );
                  })}

                  {showNow && (
                    <div className="absolute left-0 right-0 pointer-events-none" style={{ top: (nowTop / 60) * HOUR_PX }}>
                      <div className="relative h-0.5 bg-error">
                        <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-error" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  monthStart,
  today,
  maxDate,
  selectedDate,
  now,
  bookingsOn,
  onPickDate,
}: {
  monthStart: string;
  today: string;
  maxDate: string;
  selectedDate: string;
  now: number;
  bookingsOn: (day: string) => CalendarBooking[];
  onPickDate: (date: string) => void;
}) {
  const gridStart = startOfWeek(monthStart);
  const month = monthStart.slice(0, 7);
  const weeks = Math.ceil((weekdayIndex(monthStart) + new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const fullDay = 15 * 60;

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="text-center text-label-medium text-ink-subtle py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const inMonth = day.startsWith(month);
          const selectable = day >= today && day <= maxDate;
          const dayBookings = bookingsOn(day);
          const free = selectable ? freeMinutes(day, dayBookings, now) : 0;
          const total = day === today ? Math.max(freeMinutes(day, [], now), 1) : fullDay;
          const state = !selectable ? "past" : free === 0 ? "full" : dayBookings.length === 0 ? "free" : "partial";
          const tone = {
            past: "bg-surface-variant/70 text-disabled-fg border-transparent",
            full: "bg-error-container border-error-90 text-on-error-container",
            free: "bg-success-95 border-success-90 text-ink",
            partial: "bg-surface border-outline text-ink",
          }[state];
          return (
            <button
              key={day}
              type="button"
              disabled={!selectable}
              onClick={() => onPickDate(day)}
              className={`min-h-[5.5rem] sm:min-h-[7rem] rounded-sm border p-1.5 sm:p-2 flex flex-col items-stretch gap-1 text-left transition-colors ${tone} ${
                !inMonth ? "opacity-50" : ""
              } ${selectable ? "hover:border-primary" : "cursor-not-allowed"} ${
                day === selectedDate ? "ring-2 ring-primary ring-offset-1" : ""
              }`}
              aria-label={`${day} ${
                state === "past" ? "เลยเวลาแล้ว" : state === "full" ? "เต็ม" : `ว่าง ${hoursLabel(free)}`
              }`}
            >
              <span
                className={`self-start w-7 h-7 flex items-center justify-center rounded-full text-title-small tabular-nums ${
                  day === today ? "bg-primary text-on-primary" : ""
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {selectable && (
                <>
                  <span className={`text-label-small leading-tight ${state === "full" ? "" : "text-success"}`}>
                    {state === "full" ? "เต็มทั้งวัน" : state === "free" ? "ว่างทั้งวัน" : `ว่าง ${hoursLabel(free)}`}
                  </span>
                  {/* Share of the bookable day that is still free. */}
                  <span className="h-1.5 rounded-full bg-error-90 overflow-hidden" aria-hidden="true">
                    <span className="block h-full bg-success-60" style={{ width: `${Math.min(100, (free / total) * 100)}%` }} />
                  </span>
                  <span className="hidden sm:flex flex-col gap-0.5 mt-0.5">
                    {dayBookings.slice(0, 2).map((b) => (
                      <span
                        key={b.id}
                        className={`truncate rounded-xs px-1 text-label-small font-normal tabular-nums border-l-2 ${
                          b.status === "APPROVED" ? "bg-primary-container border-primary" : "bg-highlight-container border-highlight"
                        }`}
                      >
                        {formatTime(b.startTime)} {b.title || "จองแล้ว"}
                      </span>
                    ))}
                    {dayBookings.length > 2 && (
                      <span className="text-label-small text-ink-subtle">+{dayBookings.length - 2} รายการ</span>
                    )}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
