import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { membershipIn, type Dept } from "@/lib/service-rules";

const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const NO_PERM = "คุณไม่มีสิทธิ์ดำเนินการนี้";

// GET ?dept=AV : members of one department, for the assignee picker.
// Open to ADMIN and STAFF of that department only (the full list is SYSTEM_ADMIN's).
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });

    const dept = new URL(request.url).searchParams.get("dept");
    if (dept !== "AV" && dept !== "HOUSEKEEPING") {
      return NextResponse.json({ error: "แผนกไม่ถูกต้อง" }, { status: 400 });
    }
    if (!membershipIn(actor.memberships, dept as Dept)) {
      return NextResponse.json({ error: NO_PERM }, { status: 403 });
    }
    const members = await prisma.serviceMember.findMany({
      where: { department: dept as Dept },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching department members:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
