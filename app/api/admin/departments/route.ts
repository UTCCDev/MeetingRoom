import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { firstError } from "@/lib/validation";

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const nameField = z.string({ required_error: "กรุณากรอกชื่อแผนก" }).trim().min(1, "กรุณากรอกชื่อแผนก").max(100, "ชื่อแผนกยาวเกิน 100 ตัวอักษร");

async function requireSystemAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  if ((session.user as any).role !== "SYSTEM_ADMIN") {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการแผนกได้" }, { status: 403 });
  }
  return null;
}

const isUniqueError = (e: unknown) => (e as { code?: string })?.code === "P2002";

// GET departments (any signed-in user: the booking form and profile show them)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// POST create a department
export async function POST(request: NextRequest) {
  const denied = await requireSystemAdmin();
  if (denied) return denied;
  const parsed = z.object({ name: nameField }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json(await prisma.department.create({ data: { name: parsed.data.name } }), { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) return NextResponse.json({ error: "มีแผนกชื่อนี้แล้ว" }, { status: 409 });
    console.error("Error creating department:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// PUT rename a department
export async function PUT(request: NextRequest) {
  const denied = await requireSystemAdmin();
  if (denied) return denied;
  const parsed = z.object({ id: z.string().min(1), name: nameField }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json(
      await prisma.department.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } })
    );
  } catch (error) {
    if (isUniqueError(error)) return NextResponse.json({ error: "มีแผนกชื่อนี้แล้ว" }, { status: 409 });
    console.error("Error renaming department:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}

// DELETE a department (only when no user belongs to it). Body: { id }
export async function DELETE(request: NextRequest) {
  const denied = await requireSystemAdmin();
  if (denied) return denied;
  const id = (await request.json().catch(() => ({})))?.id;
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "ไม่พบแผนกนี้" }, { status: 400 });
  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!department) return NextResponse.json({ error: "ไม่พบแผนกนี้" }, { status: 404 });
    if (department._count.users > 0) {
      return NextResponse.json({ error: "มีผู้ใช้ในแผนกนี้ ย้ายผู้ใช้ออกก่อนจึงจะลบได้" }, { status: 409 });
    }
    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ message: "ลบแผนกแล้ว" });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
