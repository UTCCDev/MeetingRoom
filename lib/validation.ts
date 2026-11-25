import { z } from "zod";


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

export type Role = "USER" | "ROOM_ADMIN" | "SYSTEM_ADMIN";

/** The acting user with the flags that decide approval. Load it from the DB (lib/actor.ts), not the JWT. */
export type Actor = {
  id: string;
  role: Role;
  isPresidentApprover: boolean;
  autoApproveBooking: boolean;
  /** Only read when booking a room limited to some departments. */
  departmentId?: string | null;
};

/** Rooms with an allow-list only take bookings from those departments' staff; system admins are exempt. */
export function mayBookRoom(user: Pick<Actor, "role" | "departmentId">, allowed: { id: string }[]): boolean {
  if (allowed.length === 0 || user.role === "SYSTEM_ADMIN") return true;
  return !!user.departmentId && allowed.some((d) => d.id === user.departmentId);
}

export type RoomRule = {
  roomAdminId: string;
  requiresPresidentApproval: boolean;
  autoApprove?: boolean;
  /** Extra approvers besides the room admin. */
  approvers?: { id: string }[];
};

export type ApprovalRoute = "AUTO" | "ROOM_ADMIN" | "PRESIDENT";

/**
 * Who has to approve a new booking.
 * President rooms: AUTO only when the booker (never the beneficiary) holds both flags.
 * Normal rooms: AUTO when the booker or the beneficiary has autoApproveBooking.
 */
export function approvalRoute(booker: Actor, beneficiary: Actor | null, room: RoomRule): ApprovalRoute {
  if (room.requiresPresidentApproval) {
    return booker.autoApproveBooking && booker.isPresidentApprover ? "AUTO" : "PRESIDENT";
  }
  if (room.autoApprove) return "AUTO";
  return booker.autoApproveBooking || beneficiary?.autoApproveBooking ? "AUTO" : "ROOM_ADMIN";
}

/**
 * President rooms: only president approvers. Normal rooms: system admins, or the room's own admin.
 * Deciding one's own request is allowed; approvedById records who did it.
 */
export function canDecide(user: Actor, room: RoomRule): boolean {
  if (room.requiresPresidentApproval) return user.isPresidentApprover;
  return (
    user.role === "SYSTEM_ADMIN" ||
    (user.role === "ROOM_ADMIN" && room.roomAdminId === user.id) ||
    !!room.approvers?.some((a) => a.id === user.id)
  );
}

/** Prisma room filter matching canDecide: the rooms whose bookings this user may decide. Null = none. */
export function decidableRoomWhere(user: Actor): { OR: Record<string, unknown>[] } | null {
  const OR: Record<string, unknown>[] = [];
  if (user.role === "SYSTEM_ADMIN") OR.push({ requiresPresidentApproval: false });
  else if (user.role === "ROOM_ADMIN") {
    OR.push({ requiresPresidentApproval: false, roomAdminId: user.id });
    OR.push({ requiresPresidentApproval: false, approvers: { some: { id: user.id } } });
  }
  if (user.isPresidentApprover) OR.push({ requiresPresidentApproval: true });
  return OR.length ? { OR } : null;
}

/** Booker, beneficiary, or anyone who may decide the booking. */
export function canView(
  user: Actor,
  booking: { userId: string; bookedForId: string | null; room: RoomRule }
): boolean {
  return booking.userId === user.id || booking.bookedForId === user.id || canDecide(user, booking.room);
}

/** Booker or beneficiary may cancel. */
export function canCancel(userId: string, booking: { userId: string; bookedForId: string | null }): boolean {
  return booking.userId === userId || booking.bookedForId === userId;
}

/** Booking for yourself is stored as no beneficiary. */
export function normalizeBeneficiary(bookerId: string, bookedForId?: string | null): string | null {
  return bookedForId && bookedForId !== bookerId ? bookedForId : null;
}

/** President approval is only for admin roles; a USER never keeps it. */
export function presidentFlagFor(role: Role, requested: boolean | undefined, current: boolean): boolean {
  if (role === "USER") return false;
  return requested ?? current;
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
    bookedForId: z.string().optional().nullable(),
    departmentId: z.string().optional().nullable(),
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
