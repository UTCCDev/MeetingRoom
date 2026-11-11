import { z } from "zod";
import { bangkokDate } from "@/lib/validation";

// Pure rules for service requests (AV / HOUSEKEEPING). No prisma import.

export type Dept = "AV" | "HOUSEKEEPING";
export type SStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";
export type Membership = { department: Dept; role: "ADMIN" | "STAFF" };

export const DEPT_LABEL: Record<Dept, string> = {
  AV: "แผนกโสต",
  HOUSEKEEPING: "กองอาคาร",
};

export const LEAD_DAYS = 3;
export const CANCEL_CUTOFF_HOURS = 24;

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

export function membershipIn(ms: Membership[], d: Dept): Membership | null {
  return ms.find((m) => m.department === d) ?? null;
}

const bangkokDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

// Start must fall on or after (today + LEAD_DAYS) in Bangkok calendar days.
export function meetsLeadTime(start: Date, now: Date): boolean {
  const earliest = bangkokDay(new Date(now.getTime() + LEAD_DAYS * DAY_MS));
  return bangkokDay(start) >= earliest;
}

const TRANSITIONS: Record<SStatus, SStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DONE"],
  DONE: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionService(from: SStatus, to: SStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// Requester may cancel a PENDING request until it starts, or an ACCEPTED one
// at least CANCEL_CUTOFF_HOURS before it starts.
export function canRequesterCancel(r: { status: SStatus; startTime: Date }, now: Date): boolean {
  const untilStart = r.startTime.getTime() - now.getTime();
  if (untilStart <= 0) return false;
  if (r.status === "PENDING") return true;
  if (r.status === "ACCEPTED") return untilStart >= CANCEL_CUTOFF_HOURS * HOUR_MS;
  return false;
}

export function canManage(ms: Membership[], d: Dept): boolean {
  return membershipIn(ms, d)?.role === "ADMIN";
}

export function canWork(
  userId: string,
  ms: Membership[],
  r: { department: Dept; assigneeId: string | null },
): boolean {
  const m = membershipIn(ms, r.department);
  if (!m) return false;
  return m.role === "ADMIN" || r.assigneeId === userId;
}

export function canViewRequest(
  userId: string,
  ms: Membership[],
  r: { requesterId: string; department: Dept; visibleAt: Date | null; assigneeId: string | null },
): boolean {
  if (r.requesterId === userId) return true;
  if (r.visibleAt === null) return false;
  return canWork(userId, ms, r);
}

export function queueWhere(userId: string, m: Membership): Record<string, unknown> {
  const where: Record<string, unknown> = { department: m.department, visibleAt: { not: null } };
  if (m.role === "STAFF") where.assigneeId = userId;
  return where;
}

// ---- create schema ----
const itemSchema = z
  .object({
    catalogItemId: z.string().min(1).optional().nullable(),
    otherText: z.string().trim().max(100, "ข้อความอื่น ๆ ยาวเกิน 100 ตัวอักษร").optional().nullable(),
    qty: z.coerce
      .number({ invalid_type_error: "จำนวนไม่ถูกต้อง" })
      .int("จำนวนต้องเป็นจำนวนเต็ม")
      .min(1, "จำนวนต้องอย่างน้อย 1")
      .max(999, "จำนวนต้องไม่เกิน 999"),
  })
  .refine((i) => !!i.catalogItemId !== !!i.otherText, {
    message: "แต่ละรายการต้องเลือกอุปกรณ์หรือระบุข้อความอื่น ๆ อย่างใดอย่างหนึ่ง",
  });

export const createServiceSchema = z
  .object({
    department: z.enum(["AV", "HOUSEKEEPING"], { required_error: "กรุณาเลือกแผนก", invalid_type_error: "แผนกไม่ถูกต้อง" }),
    bookingId: z.string().min(1).optional().nullable(),
    location: z.string().trim().max(200, "สถานที่ยาวเกิน 200 ตัวอักษร").optional().nullable(),
    startTime: bangkokDate.optional().nullable(),
    endTime: bangkokDate.optional().nullable(),
    contactPhone: z
      .string({ required_error: "กรุณากรอกเบอร์ติดต่อ" })
      .trim()
      .min(1, "กรุณากรอกเบอร์ติดต่อ")
      .max(30, "เบอร์ติดต่อยาวเกิน 30 ตัวอักษร"),
    note: z.string().trim().max(1000, "หมายเหตุยาวเกิน 1000 ตัวอักษร").optional().nullable(),
    requesterId: z.string().min(1).optional().nullable(),
    items: z.array(itemSchema, { required_error: "กรุณาเลือกรายการอย่างน้อย 1 รายการ" }).min(1, "กรุณาเลือกรายการอย่างน้อย 1 รายการ"),
  })
  .superRefine((d, ctx) => {
    if (d.bookingId) return;
    if (!d.location) ctx.addIssue({ code: "custom", path: ["location"], message: "กรุณาระบุสถานที่" });
    if (!d.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "กรุณาระบุเวลาเริ่มต้น" });
    if (!d.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "กรุณาระบุเวลาสิ้นสุด" });
    if (d.startTime && d.endTime && d.endTime <= d.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น" });
    }
  });
