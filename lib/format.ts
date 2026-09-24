// Shared display helpers. All times are shown in Asia/Bangkok regardless of
// the browser or server timezone.

export const TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET = "+07:00";

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "2-digit",
});

const thaiTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** "YYYY-MM-DD" of the given instant in Bangkok time. */
export function toDateKey(value: Date | string): string {
  const parts = dateParts.formatToParts(new Date(value));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "พฤ. 24 ก.ย. 69" */
export function formatDate(value: Date | string): string {
  const d = new Date(value);
  const weekday = dateParts.formatToParts(d).find((p) => p.type === "weekday")?.value || "";
  return `${WEEKDAYS[WEEKDAY_INDEX[weekday]] ?? ""} ${thaiDate.format(d)}`.trim();
}

/** "10:00" */
export function formatTime(value: Date | string): string {
  return thaiTime.format(new Date(value));
}

/** "พฤ. 24 ก.ย. 69 · 10:00–11:00" (spans days → "... 10:00 – ศ. 25 ก.ย. 69 11:00") */
export function formatRange(start: Date | string, end: Date | string): string {
  if (toDateKey(start) === toDateKey(end)) {
    return `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)}`;
  }
  return `${formatDate(start)} · ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`;
}

/** Builds an ISO string with an explicit Bangkok offset from date + time inputs. */
export function bangkokISO(date: string, time: string): string {
  return `${date}T${time}:00${BANGKOK_OFFSET}`;
}

/** Today's date key in Bangkok. */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** Adds days to a "YYYY-MM-DD" key. */
export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Selectable booking times, every 30 minutes. */
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (const m of ["00", "30"]) {
      slots.push(`${String(h).padStart(2, "0")}:${m}`);
    }
  }
  return slots;
})();

/** "HH:MM" plus minutes, capped at the last slot. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 22 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Rooms share generic names ("ห้องประชุม"), so always show the unit and
 * location next to the name. Descriptions look like "หน่วยงาน - อาคาร 1 ชั้น 2".
 */
export function roomLabel(room: { name: string; description?: string | null }): string {
  const location = roomLocation(room.description);
  return location ? `${room.name} · ${location}` : room.name;
}

/** "หน่วยงาน · อาคาร 1 ชั้น 2" from a room description. */
export function roomLocation(description?: string | null): string {
  return (description || "")
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอการตัดสินใจ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

/** Heavent DS badge class and Material Symbols icon per booking status. */
export const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-pending",
  APPROVED: "badge-available",
  REJECTED: "badge-booked",
  CANCELLED: "badge-neutral",
};

export const STATUS_ICONS: Record<string, string> = {
  PENDING: "hourglass_top",
  APPROVED: "check_circle",
  REJECTED: "cancel",
  CANCELLED: "block",
};

/** Amenities arrive as an array, a JSON string or a comma list — always return a clean array. */
export function amenityList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return amenityList(parsed);
  } catch {
    // not JSON — fall through to a comma list
  }
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
