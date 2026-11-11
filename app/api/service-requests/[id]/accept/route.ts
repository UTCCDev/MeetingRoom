import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyDecision, notifyAssigned } from "@/lib/service-notify";
import { loadForAction, readBody, checkAssignee, fail, logNotify, CONFLICT, SERVER_ERROR } from "@/lib/service-action";

const schema = z.object({
  assigneeId: z.string({ required_error: "กรุณาเลือกผู้รับผิดชอบ" }).min(1, "กรุณาเลือกผู้รับผิดชอบ"),
  coordinatorName: z.string().trim().max(100, "ชื่อผู้ประสานงานยาวเกิน 100 ตัวอักษร").optional().nullable(),
  coordinatorPhone: z.string().trim().max(30, "เบอร์ผู้ประสานงานยาวเกิน 30 ตัวอักษร").optional().nullable(),
  internalNote: z.string().trim().max(1000, "บันทึกภายในยาวเกิน 1000 ตัวอักษร").optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await loadForAction(id, "manage");
    if (g.res) return g.res;
    const { r } = g;

    const parsed = schema.safeParse(await readBody(request));
    if (!parsed.success) return fail(parsed.error.issues[0].message, 400);
    const d = parsed.data;

    if (r.status !== "PENDING") return fail(CONFLICT, 409);
    const bad = await checkAssignee(d.assigneeId, r.department as any);
    if (bad) return bad;

    const now = new Date();
    const { count } = await prisma.serviceRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "ACCEPTED",
        assigneeId: d.assigneeId,
        assignedAt: now,
        decidedAt: now,
        coordinatorName: d.coordinatorName || null,
        coordinatorPhone: d.coordinatorPhone || null,
        internalNote: d.internalNote || null,
      },
    });
    if (count === 0) return fail(CONFLICT, 409);

    logNotify(notifyDecision(id));
    logNotify(notifyAssigned(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error accepting service request:", error);
    return fail(SERVER_ERROR, 500);
  }
}
