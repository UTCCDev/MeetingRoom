import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { firstError } from "@/lib/validation";

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const NO_PERM = "คุณไม่มีสิทธิ์ดำเนินการนี้";

const schema = z.object({
  userId: z.string({ required_error: "กรุณาเลือกผู้ใช้" }).min(1, "กรุณาเลือกผู้ใช้"),
  department: z.enum(["AV", "HOUSEKEEPING"], { errorMap: () => ({ message: "แผนกไม่ถูกต้อง" }) }),
  role: z.enum(["ADMIN", "STAFF"], { errorMap: () => ({ message: "บทบาทไม่ถูกต้อง" }) }),
});

async function requireSystemAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  const actor = await loadServiceActor(session as any);
  if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  if (actor.role !== "SYSTEM_ADMIN") return NextResponse.json({ error: NO_PERM }, { status: 403 });
  return null;
}

// GET all service memberships
export async function GET() {
  try {
    const denied = await requireSystemAdmin();
    if (denied) return denied;
    const members = await prisma.serviceMember.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ department: "asc" }, { user: { name: "asc" } }],
    });
    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching service members:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// POST add a member or change their role (upsert on userId + department)
export async function POST(request: NextRequest) {
  try {
    const denied = await requireSystemAdmin();
    if (denied) return denied;
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    const { userId, department, role } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, active: true } });
    if (!user || !user.active) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้ หรือบัญชีถูกปิดใช้งาน" }, { status: 400 });
    }
    const member = await prisma.serviceMember.upsert({
      where: { userId_department: { userId, department } },
      update: { role },
      create: { userId, department, role },
    });
    return NextResponse.json(member);
  } catch (error) {
    console.error("Error saving service member:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
