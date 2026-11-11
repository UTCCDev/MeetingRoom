import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";

// POST remove a service member (SYSTEM_ADMIN only)
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    if (actor.role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์ดำเนินการนี้" }, { status: 403 });
    }
    const { id } = await params;
    const member = await prisma.serviceMember.findUnique({ where: { id } });
    if (!member) return NextResponse.json({ error: "ไม่พบสมาชิกนี้" }, { status: 404 });
    await prisma.serviceMember.delete({ where: { id } });
    return NextResponse.json({ message: "ลบสมาชิกแล้ว" });
  } catch (error) {
    console.error("Error removing service member:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
