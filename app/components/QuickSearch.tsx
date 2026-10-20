"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/app/components/DatePicker";
import Dropdown from "@/app/components/Dropdown";
import { addMinutes, TIME_SLOTS, todayKey } from "@/lib/format";

const END_SLOTS = [...TIME_SLOTS.slice(1), "22:00"];

/** Landing-page search: date · time · seats, handed to /rooms as query params. */
export default function QuickSearch() {
  const router = useRouter();
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [seats, setSeats] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    if (date && start) qs.set("start", start);
    if (date && end) qs.set("end", end);
    if (parseInt(seats, 10) > 0) qs.set("seats", seats);
    router.push(`/rooms${qs.toString() ? `?${qs}` : ""}`);
  };

  return (
    <form
      onSubmit={submit}
      aria-label="ค้นหาห้องที่ว่าง"
      className="ui-lg grid gap-4 grid-cols-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
    >
      <div className="col-span-2 md:col-span-1 min-w-0">
        <label htmlFor="qs-date" className="field-label">วันที่</label>
        <DatePicker id="qs-date" value={date} onChange={setDate} min={todayKey()} />
      </div>
      <div className="min-w-0">
        <label htmlFor="qs-start" className="field-label">ตั้งแต่</label>
        <Dropdown
          id="qs-start"
          value={start}
          onChange={(v) => {
            setStart(v);
            if (!end || end <= v) setEnd(addMinutes(v, 60));
          }}
          options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
          searchable={false}
          className="tabular-nums"
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="qs-end" className="field-label">ถึง</label>
        <Dropdown
          id="qs-end"
          value={end}
          onChange={setEnd}
          options={END_SLOTS.filter((t) => t > start).map((t) => ({ value: t, label: t }))}
          searchable={false}
          className="tabular-nums"
        />
      </div>
      <div className="col-span-2 md:col-span-1 min-w-0">
        <label htmlFor="qs-seats" className="field-label">จำนวนคน</label>
        <div className="relative">
          <span
            className="icon icon--20 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
            aria-hidden="true"
          >
            group
          </span>
          <input
            id="qs-seats"
            type="number"
            min="1"
            inputMode="numeric"
            value={seats}
            onChange={(e) => {
              const v = e.target.value;
              setSeats(v === "" ? "" : String(Math.max(1, parseInt(v, 10) || 1)));
            }}
            placeholder="ไม่ระบุ"
            className="input-field pl-11 tabular-nums"
          />
        </div>
      </div>
      <button type="submit" className="btn-primary col-span-2 md:col-span-1 !h-14 !px-8 !text-title-medium">
        <span className="icon icon--24" aria-hidden="true">search</span>
        ค้นหาห้องว่าง
      </button>
    </form>
  );
}
