import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { canManage, canWork, membershipIn, DEPT_LABEL, type Dept } from "@/lib/service-rules";

export const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
export const CONFLICT = "คำร้องนี้ถูกเปลี่ยนสถานะแล้ว";
const NOT_FOUND = "ไม่พบคำร้อง";
const FORBIDDEN = "คุณไม่มีสิทธิ์ดำเนินการนี้";

export const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Shared guard for department actions. Returns the request or an error response.
 * Hidden / missing / non-member -> 404; member without the right -> 403
 * (a STAFF member who is not the assignee on a "work" action -> 404).
 */
export async function loadForAction(id: string, need: "manage" | "work") {
  const session = await getServerSession(authOptions);
  const actor = await loadServiceActor(session as any);
  if (!actor) return { res: fail("ไม่ได้รับอนุญาต", 401) };

  const r = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { items: { include: { catalogItem: { select: { returnable: true } } } } },
  });
  if (!r || r.visibleAt === null || !membershipIn(actor.memberships, r.department as Dept)) {
    return { res: fail(NOT_FOUND, 404) };
  }
  if (need === "manage") {
    if (!canManage(actor.memberships, r.department as Dept)) return { res: fail(FORBIDDEN, 403) };
  } else if (!canWork(actor.id, actor.memberships, r as any)) {
    return { res: fail(NOT_FOUND, 404) };
  }
  return { actor, r };
}

export async function readBody(request: Request): Promise<any> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}

/** Assignee must be a member (ADMIN or STAFF) of the department. Returns an error response or null. */
export async function checkAssignee(assigneeId: string, department: Dept) {
  const m = await prisma.serviceMember.findFirst({
    where: { userId: assigneeId, department, role: { in: ["ADMIN", "STAFF"] } },
  });
  return m ? null : fail(`ผู้รับผิดชอบต้องเป็นเจ้าหน้าที่ของ${DEPT_LABEL[department]}`, 400);
}

export const logNotify = (p: Promise<unknown>) => p.catch((e) => console.error("service notify failed:", e));
