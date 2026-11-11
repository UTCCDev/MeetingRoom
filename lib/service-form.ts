import { LEAD_DAYS, meetsLeadTime, type Dept } from "@/lib/service-rules";

// Pure client-side helpers for the service request form (no React, no server imports).

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
export const LEAD_HINT = `ต้องขอล่วงหน้าอย่างน้อย ${LEAD_DAYS} วัน`;
export const PHONE_KEY = "svc-phone";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface OtherRow {
  key: number;
  text: string;
  qty: number;
}

export interface ServiceFormValue {
  /** catalogItemId -> qty of the ticked catalog items */
  selected: Record<string, number>;
  others: OtherRow[];
  phone: string;
  note: string;
  files: File[];
  // standalone only
  location: string;
  date: string;
  startTime: string;
  endTime: string;
}

export const emptyServiceForm = (): ServiceFormValue => ({
  selected: {},
  others: [],
  phone: "",
  note: "",
  files: [],
  location: "",
  date: "",
  startTime: "",
  endTime: "",
});

export type ServiceFormErrors = Partial<Record<"items" | "phone" | "files" | "location" | "date" | "time" | "lead", string>>;

/** A tab counts as "filled" once any equipment is ticked or an other-row has text. */
export function isServiceFormFilled(v: ServiceFormValue): boolean {
  return Object.keys(v.selected).length > 0 || v.others.some((o) => o.text.trim() !== "");
}

export function validateFiles(files: { name: string; size: number; type: string }[]): string | undefined {
  if (files.length > MAX_FILES) return `แนบไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์`;
  for (const f of files) {
    const okType = ALLOWED_TYPES.includes(f.type) || /\.(pdf|jpe?g|png|webp)$/i.test(f.name);
    if (!okType) return `ไฟล์ ${f.name} ไม่รองรับ (รองรับ PDF, JPG, PNG, WebP)`;
    if (f.size > MAX_FILE_BYTES) return `ไฟล์ ${f.name} ใหญ่เกิน 5 MB`;
  }
  return undefined;
}

/**
 * Validates one form. `start` is the service start (the booking's start when embedded,
 * built from date/time when standalone). Lead time is skipped when `skipLead` (on-behalf filing).
 */
export function validateServiceForm(
  v: ServiceFormValue,
  opts: { standalone: boolean; start: Date | null; now: Date; skipLead?: boolean },
): ServiceFormErrors {
  const e: ServiceFormErrors = {};
  const itemCount = Object.keys(v.selected).length + v.others.filter((o) => o.text.trim() !== "").length;
  if (itemCount === 0) e.items = "กรุณาเลือกรายการอย่างน้อย 1 รายการ";
  if (!v.phone.trim()) e.phone = "กรุณากรอกเบอร์ติดต่อ";
  const fileErr = validateFiles(v.files);
  if (fileErr) e.files = fileErr;
  if (opts.standalone) {
    if (!v.location.trim()) e.location = "กรุณาระบุสถานที่";
    if (!v.date) e.date = "กรุณาเลือกวันที่";
    if (!v.startTime || !v.endTime) e.time = "กรุณาเลือกเวลาเริ่มต้นและสิ้นสุด";
    else if (v.endTime <= v.startTime) e.time = "เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น";
  }
  if (!opts.skipLead && opts.start && !meetsLeadTime(opts.start, opts.now)) e.lead = LEAD_HINT;
  return e;
}

export const hasErrors = (e: ServiceFormErrors) => Object.keys(e).length > 0;

export function buildServicePayload(
  department: Dept,
  v: ServiceFormValue,
  extra: { bookingId?: string; requesterId?: string; startISO?: string; endISO?: string } = {},
) {
  const items = [
    ...Object.entries(v.selected).map(([catalogItemId, qty]) => ({ catalogItemId, qty })),
    ...v.others.filter((o) => o.text.trim() !== "").map((o) => ({ otherText: o.text.trim(), qty: o.qty })),
  ];
  return {
    department,
    bookingId: extra.bookingId,
    requesterId: extra.requesterId,
    ...(extra.bookingId
      ? {}
      : { location: v.location.trim(), startTime: extra.startISO, endTime: extra.endISO }),
    contactPhone: v.phone.trim(),
    note: v.note.trim() || undefined,
    items,
  };
}

/** POST one request (multipart). Returns the created id, or a Thai error message. */
export async function submitServiceRequest(
  payload: ReturnType<typeof buildServicePayload>,
  files: File[],
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fd = new FormData();
  fd.append("data", JSON.stringify(payload));
  for (const f of files) fd.append("files", f);
  try {
    const res = await fetch("/api/service-requests", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "ส่งคำร้องไม่สำเร็จ" };
    try {
      localStorage.setItem(PHONE_KEY, payload.contactPhone);
    } catch {}
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" };
  }
}
