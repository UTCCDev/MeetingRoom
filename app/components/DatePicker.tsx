"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, todayKey } from "@/lib/format";
import { usePopoverPlacement } from "@/app/components/usePopoverPlacement";

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const parse = (key: string) => key.split("-").map(Number) as [number, number, number];
const keyOf = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "12 ต.ค. 2569" */
export function formatThaiDate(key: string): string {
  const [y, m, d] = parse(key);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/** The 6×7 days shown for a month, starting on Sunday. */
function monthDays(year: number, month: number): string[] {
  const first = keyOf(year, month, 1);
  const lead = new Date(`${first}T00:00:00Z`).getUTCDay();
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Date field per design.md › Date picker: dropdown-style trigger showing "12 ต.ค. 2569",
 * calendar panel with today ring and primary selection. Value is ISO "YYYY-MM-DD" ("" = none).
 */
export default function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "เลือกวันที่",
  invalid = false,
  clearable = false,
  align = "start",
  "aria-describedby": describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  /** Show a "ล้าง" button, for optional filters. */
  clearable?: boolean;
  align?: "start" | "end";
  "aria-describedby"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Flips above the field near the bottom of the screen and caps its height to fit.
  const placement = usePopoverPlacement(open, triggerRef, panelRef);
  const [focused, setFocused] = useState(value || today);
  const [year, month] = parse(focused);

  const outOfRange = (key: string) => (!!min && key < min) || (!!max && key > max);
  const clamp = (key: string) => (min && key < min ? min : max && key > max ? max : key);

  const openPanel = () => {
    setFocused(clamp(value || today));
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const choose = (key: string) => {
    if (outOfRange(key)) return;
    onChange(key);
    close();
  };
  const shiftMonth = (step: number) => {
    let m = month + step;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const [, , d] = parse(focused);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    setFocused(keyOf(y, m, Math.min(d, last)));
  };

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep keyboard focus on the focused day while the panel is open.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${focused}"]`)?.focus();
  }, [open, focused]);

  const onGridKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      setFocused(addDays(focused, moves[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      shiftMonth(e.key === "PageUp" ? -1 : 1);
    }
  };

  const days = monthDays(year, month);
  const firstOfMonth = keyOf(year, month, 1);
  const prevDisabled = !!min && addDays(firstOfMonth, -1) < min;
  const nextDisabled = !!max && keyOf(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()) >= max;
  const panelId = `${id}-panel`;

  return (
    <div
      ref={rootRef}
      className={`datepicker ${align === "end" ? "datepicker--end" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="dropdown__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openPanel())}
      >
        <span className={`dropdown__value tabular-nums ${value ? "" : "dropdown__value--placeholder"}`}>
          {value ? formatThaiDate(value) : placeholder}
        </span>
        <span className="icon icon--24 !rotate-0" aria-hidden="true">calendar_today</span>
      </button>

      {open && (
        <div ref={panelRef} id={panelId} className="datepicker__panel" role="dialog" aria-modal="false" aria-label="เลือกวันที่" style={placement.style}>
          <div className="datepicker__header">
            <button type="button" className="datepicker__nav" onClick={() => shiftMonth(-1)} disabled={prevDisabled} aria-label="เดือนก่อนหน้า">
              <span className="icon icon--24" aria-hidden="true">chevron_left</span>
            </button>
            <p className="datepicker__title" aria-live="polite">
              {MONTHS[month - 1]} {year + 543}
            </p>
            <button type="button" className="datepicker__nav" onClick={() => shiftMonth(1)} disabled={nextDisabled} aria-label="เดือนถัดไป">
              <span className="icon icon--24" aria-hidden="true">chevron_right</span>
            </button>
          </div>

          <div ref={gridRef} className="datepicker__grid" role="grid" onKeyDown={onGridKey}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="datepicker__weekday" role="columnheader">{w}</span>
            ))}
            {days.map((key) => {
              const [, m, d] = parse(key);
              return (
                <span key={key} className="datepicker__cell" role="gridcell">
                  <button
                    type="button"
                    data-key={key}
                    className={`datepicker__day ${m !== month ? "is-outside" : ""}`}
                    tabIndex={key === focused ? 0 : -1}
                    aria-selected={key === value}
                    aria-current={key === today ? "date" : undefined}
                    aria-label={formatThaiDate(key)}
                    disabled={outOfRange(key)}
                    onClick={() => choose(key)}
                  >
                    {d}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="datepicker__footer">
            {clearable && value && (
              <button type="button" className="btn-text" onClick={() => { onChange(""); close(); }}>
                ล้าง
              </button>
            )}
            <button type="button" className="btn-text" disabled={outOfRange(today)} onClick={() => choose(today)}>
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
