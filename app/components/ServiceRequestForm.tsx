"use client";

import { useEffect, useRef, useState } from "react";
import DatePicker from "@/app/components/DatePicker";
import Dropdown from "@/app/components/Dropdown";
import { addDays, TIME_SLOTS, todayKey } from "@/lib/format";
import {
  FILE_ACCEPT,
  LEAD_HINT,
  MAX_FILES,
  PHONE_KEY,
  type ServiceFormErrors,
  type ServiceFormValue,
} from "@/lib/service-form";
import type { Dept } from "@/lib/service-rules";

interface CatalogItem {
  id: string;
  name: string;
  returnable: boolean;
  sortOrder: number;
}

const END_SLOTS = [...TIME_SLOTS.slice(1), "22:00"];
let rowKey = 1;

function Err({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error flex items-center gap-1" role="alert">
      <span className="icon icon--20" aria-hidden="true">error</span>
      {message}
    </p>
  );
}

const clampQty = (raw: string) => Math.min(999, Math.max(1, Number(raw.replace(/\D/g, "")) || 1));

/**
 * Request form for one department. Controlled: the parent owns `value` and shows `errors`.
 * "embedded" = inside a booking (time/place come from the booking);
 * "standalone" = its own request, so it also asks for location, date and time.
 */
export default function ServiceRequestForm({
  department,
  mode,
  value,
  onChange,
  errors = {},
  showLeadHint = true,
}: {
  department: Dept;
  mode: "embedded" | "standalone";
  value: ServiceFormValue;
  onChange: (next: ServiceFormValue) => void;
  errors?: ServiceFormErrors;
  showLeadHint?: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;
  const idp = `svc-${department}-${mode}`;
  const standalone = mode === "standalone";

  useEffect(() => {
    let alive = true;
    setCatalog(null);
    setLoadError("");
    fetch(`/api/service-catalog?dept=${department}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && Array.isArray(data)) setCatalog(data);
        else setLoadError((data && data.error) || "โหลดรายการอุปกรณ์ไม่สำเร็จ");
      })
      .catch(() => alive && setLoadError("โหลดรายการอุปกรณ์ไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [department]);

  // Prefill the phone from the last request (once, only if still empty).
  useEffect(() => {
    if (valueRef.current.phone) return;
    try {
      const saved = localStorage.getItem(PHONE_KEY);
      if (saved) onChange({ ...valueRef.current, phone: saved });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<ServiceFormValue>) => onChange({ ...value, ...patch });

  const toggle = (id: string, on: boolean) => {
    const selected = { ...value.selected };
    if (on) selected[id] = selected[id] ?? 1;
    else delete selected[id];
    set({ selected });
  };

  const setOther = (key: number, patch: Partial<{ text: string; qty: number }>) =>
    set({ others: value.others.map((o) => (o.key === key ? { ...o, ...patch } : o)) });

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    set({ files: [...value.files, ...Array.from(list)] });
  };

  return (
    <div className="space-y-6">
      {showLeadHint && (
        <p className="field-hint flex items-center gap-2">
          <span className="icon icon--20" aria-hidden="true">info</span>
          {LEAD_HINT}
        </p>
      )}
      <Err id={`${idp}-lead`} message={errors.lead} />

      {standalone && (
        <>
          <div>
            <label htmlFor={`${idp}-location`} className="field-label">สถานที่ *</label>
            <input
              id={`${idp}-location`}
              type="text"
              maxLength={200}
              value={value.location}
              onChange={(e) => set({ location: e.target.value })}
              className={`input-field ${errors.location ? "border-error" : ""}`}
              placeholder="เช่น อาคาร 5 ห้อง 501"
              aria-invalid={!!errors.location}
            />
            <Err id={`${idp}-location-error`} message={errors.location} />
          </div>
          <div>
            <label htmlFor={`${idp}-date`} className="field-label">วันที่ *</label>
            <DatePicker
              id={`${idp}-date`}
              value={value.date}
              onChange={(d) => set({ date: d })}
              min={todayKey()}
              max={addDays(todayKey(), 365)}
              invalid={!!errors.date}
            />
            <Err id={`${idp}-date-error`} message={errors.date} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${idp}-start`} className="field-label">เริ่ม *</label>
              <Dropdown
                id={`${idp}-start`}
                value={value.startTime}
                onChange={(v) => set({ startTime: v, endTime: value.endTime > v ? value.endTime : "" })}
                options={[{ value: "", label: "--:--" }, ...TIME_SLOTS.map((t) => ({ value: t, label: t }))]}
                searchable={false}
                className="tabular-nums"
                invalid={!!errors.time}
              />
            </div>
            <div>
              <label htmlFor={`${idp}-end`} className="field-label">สิ้นสุด *</label>
              <Dropdown
                id={`${idp}-end`}
                value={value.endTime}
                onChange={(v) => set({ endTime: v })}
                options={[
                  { value: "", label: "--:--" },
                  ...END_SLOTS.filter((t) => !value.startTime || t > value.startTime).map((t) => ({ value: t, label: t })),
                ]}
                searchable={false}
                className="tabular-nums"
                invalid={!!errors.time}
              />
            </div>
          </div>
          <Err id={`${idp}-time-error`} message={errors.time} />
        </>
      )}

      <fieldset>
        <legend className="field-label">รายการที่ต้องการ *</legend>
        {loadError && (
          <div className="alert alert--error mb-3" role="alert">
            <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
            {loadError}
          </div>
        )}
        {!catalog && !loadError && <p className="text-body-small text-ink-subtle">กำลังโหลดรายการ…</p>}
        {catalog && catalog.length === 0 && (
          <p className="text-body-small text-ink-subtle">ยังไม่มีรายการอุปกรณ์ในแผนกนี้ ระบุเองได้ที่ “อื่น ๆ”</p>
        )}
        <ul className="space-y-2">
          {(catalog ?? []).map((item) => {
            const checked = item.id in value.selected;
            return (
              <li key={item.id} className="flex items-center gap-3 min-h-11">
                <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-body-large text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                  />
                  <span className="min-w-0 break-words">{item.name}</span>
                </label>
                {checked && (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={value.selected[item.id]}
                    onChange={(e) => set({ selected: { ...value.selected, [item.id]: clampQty(e.target.value) } })}
                    className="input-field !w-20 text-center tabular-nums"
                    aria-label={`จำนวน ${item.name}`}
                  />
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 space-y-2">
          <p className="text-title-small text-ink">อื่น ๆ</p>
          {value.others.map((o) => (
            <div key={o.key} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={100}
                value={o.text}
                onChange={(e) => setOther(o.key, { text: e.target.value })}
                className="input-field flex-1 min-w-0"
                placeholder="ระบุรายการ"
                aria-label="รายการอื่น ๆ"
              />
              <input
                type="text"
                inputMode="numeric"
                value={o.qty}
                onChange={(e) => setOther(o.key, { qty: clampQty(e.target.value) })}
                className="input-field !w-20 text-center tabular-nums"
                aria-label="จำนวน"
              />
              <button
                type="button"
                className="icon-button"
                aria-label="ลบรายการ"
                onClick={() => set({ others: value.others.filter((x) => x.key !== o.key) })}
              >
                <span className="icon icon--24" aria-hidden="true">delete</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-text"
            onClick={() => set({ others: [...value.others, { key: rowKey++, text: "", qty: 1 }] })}
          >
            <span className="icon icon--20" aria-hidden="true">add</span>
            เพิ่มรายการอื่น ๆ
          </button>
        </div>
        <Err id={`${idp}-items-error`} message={errors.items} />
      </fieldset>

      <div>
        <label htmlFor={`${idp}-phone`} className="field-label">เบอร์ติดต่อ *</label>
        <input
          id={`${idp}-phone`}
          type="tel"
          maxLength={30}
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
          className={`input-field ${errors.phone ? "border-error" : ""}`}
          placeholder="เช่น 081-234-5678"
          aria-invalid={!!errors.phone}
        />
        <Err id={`${idp}-phone-error`} message={errors.phone} />
      </div>

      <div>
        <label htmlFor={`${idp}-note`} className="field-label">หมายเหตุ</label>
        <textarea
          id={`${idp}-note`}
          rows={3}
          maxLength={1000}
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
          className="input-field"
          placeholder="รายละเอียดเพิ่มเติม..."
        />
      </div>

      <div>
        <label htmlFor={`${idp}-files`} className="field-label">
          ไฟล์แนบ <span className="text-ink-subtle font-normal">(PDF, JPG, PNG, WebP ไม่เกิน 5 MB, สูงสุด {MAX_FILES} ไฟล์)</span>
        </label>
        <input
          id={`${idp}-files`}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
          className="input-field"
        />
        {value.files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {value.files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-body-medium text-ink">
                <span className="icon icon--20 text-ink-subtle" aria-hidden="true">attach_file</span>
                <span className="flex-1 min-w-0 truncate">{f.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`ลบไฟล์ ${f.name}`}
                  onClick={() => set({ files: value.files.filter((_, j) => j !== i) })}
                >
                  <span className="icon icon--20" aria-hidden="true">close</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Err id={`${idp}-files-error`} message={errors.files} />
      </div>
    </div>
  );
}
