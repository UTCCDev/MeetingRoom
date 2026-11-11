import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { canManage } from "@/lib/service-rules";
import { firstError } from "@/lib/validation";

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const NO_PERM = "คุณไม่มีสิทธิ์ดำเนินการนี้";
const DEPTS = ["AV", "HOUSEKEEPING"] as const;
type Dept = (typeof DEPTS)[number];

const schema = z.object({
  id: z.string().min(1).optional(),
  department: z.enum(DEPTS, { errorMap: () => ({ message: "แผนกไม่ถูกต้อง" }) }),
  name: z.string({ required_error: "กรุณากรอกชื่อรายการ" }).trim().min(1, "กรุณากรอกชื่อรายการ").max(100, "ชื่อรายการยาวเกิน 100 ตัวอักษร"),
  returnable: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// GET all catalog items (including inactive) of one department. Department ADMIN only.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });

    const dept = new URL(request.url).searchParams.get("dept");
    if (dept !== "AV" && dept !== "HOUSEKEEPING") {
      return NextResponse.json({ error: "แผนกไม่ถูกต้อง" }, { status: 400 });
    }
    if (!canManage(actor.memberships, dept as Dept)) {
      return NextResponse.json({ error: NO_PERM }, { status: 403 });
    }
    const items = await prisma.serviceCatalogItem.findMany({
      where: { department: dept as Dept },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching service catalog (manage):", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// POST create or update ({ id } given) a catalog item. Items are deactivated, never deleted.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    const { id, ...data } = parsed.data as typeof parsed.data & { department: Dept; name: string };

    if (!canManage(actor.memberships, data.department)) {
      return NextResponse.json({ error: NO_PERM }, { status: 403 });
    }

    if (id) {
      const existing = await prisma.serviceCatalogItem.findUnique({ where: { id } });
      if (!existing || existing.department !== data.department) {
        return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
      }
      return NextResponse.json(await prisma.serviceCatalogItem.update({ where: { id }, data }));
    }
    return NextResponse.json(await prisma.serviceCatalogItem.create({ data }));
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "มีรายการนี้อยู่แล้ว" }, { status: 409 });
    }
    console.error("Error saving service catalog item:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
