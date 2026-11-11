import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { canRequesterCancel } from "@/lib/service-rules";
import { notifyCancelled } from "@/lib/service-notify";
import { fail, logNotify, CONFLICT, SERVER_ERROR } from "@/lib/service-action";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await loadServiceActor((await getServerSession(authOptions)) as any);
    if (!actor) return fail("ไม่ได้รับอนุญาต", 401);

    const r = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!r || r.requesterId !== actor.id) return fail("ไม่พบคำร้อง", 404);

    const now = new Date();
    if (!canRequesterCancel(r as any, now)) {
      return fail("ยกเลิกได้ถึง 24 ชม. ก่อนเวลาใช้งาน กรุณาติดต่อเจ้าหน้าที่", 409);
    }

    const { count } = await prisma.serviceRequest.updateMany({
      where: { id, status: r.status },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    if (count === 0) return fail(CONFLICT, 409);

    if (r.visibleAt) logNotify(notifyCancelled(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error cancelling service request:", error);
    return fail(SERVER_ERROR, 500);
  }
}
