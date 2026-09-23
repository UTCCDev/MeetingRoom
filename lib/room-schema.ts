import { z } from "zod";

export const roomSchema = z.object({
  name: z.string({ required_error: "กรุณากรอกชื่อห้อง" }).trim().min(1, "กรุณากรอกชื่อห้อง").max(191, "ชื่อห้องยาวเกินไป"),
  description: z.string().trim().max(2000, "รายละเอียดยาวเกินไป").optional().nullable(),
  capacity: z.coerce
    .number({ invalid_type_error: "จำนวนที่นั่งไม่ถูกต้อง" })
    .int("จำนวนที่นั่งต้องเป็นจำนวนเต็ม")
    .min(1, "จำนวนที่นั่งต้องมากกว่า 0")
    .max(1000, "จำนวนที่นั่งมากเกินไป"),
  image: z
    .string()
    .trim()
    .max(191, "URL รูปภาพยาวเกินไป")
    .refine((s) => s === "" || /^https?:\/\//i.test(s), "URL รูปภาพต้องขึ้นต้นด้วย http:// หรือ https://")
    .optional()
    .nullable(),
  amenities: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  roomAdminId: z.string().min(1, "กรุณาเลือกผู้ดูแลห้อง"),
  status: z.boolean().optional(),
});
