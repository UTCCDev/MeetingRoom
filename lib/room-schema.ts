import { z } from "zod";
import { PHOTO_SHOTS, PHOTO_URL_ERROR, SHOT_INFO, isPhotoUrl, type PhotoShot } from "./room-photos";
import { ROOM_CODE_PATTERN, ROOM_TYPES, ROOM_TYPE_PREFIX, type RoomType } from "./room-code";

/** Error message when a code's prefix doesn't match the room type, else null. */
export function roomCodeMismatch(code: string | null | undefined, roomType: RoomType | undefined): string | null {
  if (!code || !roomType) return null;
  return code.startsWith(ROOM_TYPE_PREFIX[roomType]) ? null : "รหัสห้องต้องขึ้นต้นด้วยตัวย่อของประเภทห้อง";
}

/** Prisma unique-constraint error on rooms.code. */
export function isDuplicateRoomCode(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } };
  return e?.code === "P2002" && String(e.meta?.target ?? "").includes("code");
}

export const DUPLICATE_ROOM_CODE_ERROR = "รหัสห้องนี้ถูกใช้แล้ว กรุณาตรวจสอบอาคาร ชั้น และเลขห้อง";

export const roomSchema = z.object({
  roomType: z.enum(ROOM_TYPES, { errorMap: () => ({ message: "ประเภทห้องไม่ถูกต้อง" }) }).optional(),
  roomNumber: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "เลขห้องต้องเป็นตัวเลข 1–2 หลัก")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  code: z
    .string()
    .trim()
    .regex(ROOM_CODE_PATTERN, "รหัสห้องไม่ถูกต้อง (เช่น M030401)")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  name: z.string({ required_error: "กรุณากรอกชื่อห้อง" }).trim().min(1, "กรุณากรอกชื่อห้อง").max(191, "ชื่อห้องยาวเกินไป"),
  description: z.string().trim().max(2000, "รายละเอียดยาวเกินไป").optional().nullable(),
  capacity: z.coerce
    .number({ invalid_type_error: "จำนวนที่นั่งไม่ถูกต้อง" })
    .int("จำนวนที่นั่งต้องเป็นจำนวนเต็ม")
    .min(1, "จำนวนที่นั่งต้องมากกว่า 0")
    .max(1000, "จำนวนที่นั่งมากเกินไป"),
  pricePerHour: z.coerce
    .number({ invalid_type_error: "ราคาค่าเช่าไม่ถูกต้อง" })
    .int("ราคาค่าเช่าต้องเป็นจำนวนเต็ม")
    .min(0, "ราคาค่าเช่าต้องไม่ติดลบ")
    .max(1000000, "ราคาค่าเช่าสูงเกินไป")
    .optional(),
  image: z
    .string()
    .trim()
    .max(191, "URL รูปภาพยาวเกินไป")
    .refine(isPhotoUrl, `รูปภาพ${PHOTO_URL_ERROR}`)
    .optional()
    .nullable(),
  amenities: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  photos: z
    .object(
      Object.fromEntries(
        PHOTO_SHOTS.map((shot) => [
          shot,
          z
            .string()
            .trim()
            .max(1000, `URL รูป${SHOT_INFO[shot].title}ยาวเกินไป`)
            .refine(isPhotoUrl, `รูป${SHOT_INFO[shot].title}${PHOTO_URL_ERROR}`)
            .optional(),
        ])
      ) as Record<PhotoShot, z.ZodOptional<z.ZodEffects<z.ZodString>>>
    )
    .strip()
    // Drop empty fields so cleared photos fall back to the sample.
    .transform((p) => Object.fromEntries(Object.entries(p).filter(([, url]) => url)))
    .optional(),
  roomAdminId: z.string().min(1, "กรุณาเลือกผู้ดูแลห้อง"),
  status: z.boolean().optional(),
});
