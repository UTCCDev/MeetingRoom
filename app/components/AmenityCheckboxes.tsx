"use client";

import { useState } from "react";

export const AMENITY_OPTIONS = [
  { value: "projector", label: "โปรเจกเตอร์" },
  { value: "whiteboard", label: "กระดานไวท์บอร์ด" },
  { value: "videoconference", label: "ระบบวิดีโอคอนเฟอเรนซ์" },
  { value: "printer", label: "เครื่องพิมพ์" },
  { value: "tv", label: "โทรทัศน์ / จอมอนิเตอร์" },
  { value: "microphone", label: "ไมโครโฟน" },
];

// Same limits as the room schema (lib/room-schema.ts).
const MAX_AMENITIES = 20;
const MAX_LENGTH = 50;

/**
 * Amenity checkboxes (design.md › Checkbox), two columns, plus amenities the admin types in
 * (e.g. "ปลั๊กไฟ", "เครื่องฟอกอากาศ"), shown as removable chips and stored as plain text.
 */
export default function AmenityCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const known = new Set(AMENITY_OPTIONS.map((o) => o.value));
  const custom = selected.filter((a) => !known.has(a));

  const add = () => {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    // Typing a built-in one's label ticks its checkbox instead of adding a duplicate.
    const value = AMENITY_OPTIONS.find((o) => o.label === name)?.value ?? name;
    if (selected.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setError("มีรายการนี้แล้ว");
      return;
    }
    if (selected.length >= MAX_AMENITIES) {
      setError(`เพิ่มได้สูงสุด ${MAX_AMENITIES} รายการ`);
      return;
    }
    onChange([...selected, value]);
    setDraft("");
    setError("");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4">
        {AMENITY_OPTIONS.map((opt) => (
          <label key={opt.value} htmlFor={`room-amenity-${opt.value}`} className="checkbox">
            <input
              id={`room-amenity-${opt.value}`}
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, opt.value]
                    : selected.filter((a) => a !== opt.value)
                )
              }
            />
            {opt.label}
          </label>
        ))}
      </div>

      {custom.length > 0 && (
        <ul className="chip-group" aria-label="สิ่งอำนวยความสะดวกที่เพิ่มเอง">
          {custom.map((a) => (
            <li key={a}>
              <button
                type="button"
                className="chip"
                onClick={() => onChange(selected.filter((s) => s !== a))}
                aria-label={`ลบ ${a}`}
              >
                {a}
                <span className="icon" aria-hidden="true">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="room-amenity-custom" className="sr-only">เพิ่มสิ่งอำนวยความสะดวกอื่น</label>
        <div className="flex gap-2">
          <input
            id="room-amenity-custom"
            type="text"
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              // Enter adds the item instead of submitting the room form.
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="input-field flex-1"
            placeholder="เพิ่มรายการอื่น เช่น ปลั๊กไฟ, เครื่องฟอกอากาศ"
            aria-invalid={!!error}
            aria-describedby={error ? "room-amenity-custom-error" : undefined}
          />
          <button type="button" className="btn-tonal" onClick={add} disabled={!draft.trim()}>
            <span className="icon icon--20" aria-hidden="true">add</span>
            เพิ่ม
          </button>
        </div>
        {error && (
          <p id="room-amenity-custom-error" className="field-error" role="alert">{error}</p>
        )}
      </div>
    </div>
  );
}
