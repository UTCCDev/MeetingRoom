"use client";

export const AMENITY_OPTIONS = [
  { value: "projector", label: "โปรเจกเตอร์" },
  { value: "whiteboard", label: "กระดานไวท์บอร์ด" },
  { value: "videoconference", label: "ระบบวิดีโอคอนเฟอเรนซ์" },
  { value: "printer", label: "เครื่องพิมพ์" },
  { value: "tv", label: "โทรทัศน์ / จอมอนิเตอร์" },
  { value: "microphone", label: "ไมโครโฟน" },
];

/** Amenity checkboxes (design.md › Checkbox), two columns. */
export default function AmenityCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
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
  );
}
