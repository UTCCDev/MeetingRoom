import { z } from "zod";

type SessionUser = { id: string; role: string };

export const PASSWORD_MIN_LENGTH = 8;

// Allowed status changes. Anything not listed is rejected.
//   PENDING  → APPROVED | REJECTED   (room admin / system admin)
//   PENDING  → CANCELLED             (owner)
//   APPROVED → CANCELLED             (owner)
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** System admins decide any booking; room admins only bookings for their rooms. */
export function canDecide(user: SessionUser, room: { roomAdminId: string }): boolean {
  return user.role === "SYSTEM_ADMIN" || room.roomAdminId === user.id;
}

/** Owner, the room's admin, or a system admin may view a booking. */
export function canView(
  user: SessionUser,
  booking: { userId: string; room: { roomAdminId: string } }
): boolean {
  return booking.userId === user.id || canDecide(user, booking.room);
}

// Timestamps without an explicit offset are interpreted as Bangkok time so
// the result doesn't depend on the server's timezone.
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
export const bangkokDate = z
  .string({ required_error: "กรุณาระบุเวลา" })
  .transform((s, ctx) => {
    const d = new Date(HAS_OFFSET.test(s) ? s : `${s}+07:00`);
    if (isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "รูปแบบเวลาไม่ถูกต้อง" });
      return z.NEVER;
    }
    return d;
  });

const MAX_ADVANCE_MS = 366 * 24 * 60 * 60 * 1000;

export const createBookingSchema = z
  .object({
    roomId: z.string({ required_error: "กรุณาเลือกห้อง" }).min(1, "กรุณาเลือกห้อง"),
    title: z
      .string({ required_error: "กรุณากรอกชื่อเรื่องการประชุม" })
      .trim()
      .min(1, "กรุณากรอกชื่อเรื่องการประชุม")
      .max(200, "ชื่อเรื่องยาวเกิน 200 ตัวอักษร"),
    description: z.string().trim().max(2000, "รายละเอียดยาวเกิน 2000 ตัวอักษร").optional().nullable(),
    attendees: z.coerce
      .number({ invalid_type_error: "จำนวนผู้เข้าร่วมไม่ถูกต้อง" })
      .int("จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็ม")
      .min(1, "ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน"),
    startTime: bangkokDate,
    endTime: bangkokDate,
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น",
    path: ["endTime"],
  })
  .refine((d) => d.startTime > new Date(), {
    message: "ไม่สามารถจองย้อนหลังได้",
    path: ["startTime"],
  })
  .refine((d) => d.startTime.getTime() - Date.now() < MAX_ADVANCE_MS, {
    message: "จองล่วงหน้าได้ไม่เกิน 1 ปี",
    path: ["startTime"],
  });

export const passwordSchema = z
  .string({ required_error: "กรุณากรอกรหัสผ่าน" })
  .min(PASSWORD_MIN_LENGTH, `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`)
  .max(128, "รหัสผ่านยาวเกินไป");

// Comma-separated list, e.g. "utcc.ac.th". Set to "*" to allow any domain.
export const ALLOWED_EMAIL_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "utcc.ac.th")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes("*") || (!!domain && ALLOWED_EMAIL_DOMAINS.includes(domain));
}

export const emailSchema = z
  .string({ required_error: "กรุณากรอกอีเมล" })
  .trim()
  .email("รูปแบบอีเมลไม่ถูกต้อง");

export const nameSchema = z
  .string({ required_error: "กรุณากรอกชื่อ-สกุล" })
  .trim()
  .min(1, "กรุณากรอกชื่อ-สกุล")
  .max(100, "ชื่อยาวเกิน 100 ตัวอักษร");

/** First zod error message, for a single-line API error. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง";
}
