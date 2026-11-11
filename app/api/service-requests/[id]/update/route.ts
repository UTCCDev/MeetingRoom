import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bangkokDate } from "@/lib/validation";
import { notifyAssigned } from "@/lib/service-notify";
import { loadForAction, readBody, checkAssignee, fail, logNotify, CONFLICT, SERVER_ERROR } from "@/lib/service-action";

const schema = z.object({
  assigneeId: z.string().min(1, "กรุณาเลือกผู้รับผิดชอบ").optional(),
  coordinatorName: z.string().trim().max(100, "ชื่อผู้ประสานงานยาวเกิน 100 ตัวอักษร").optional().nullable(),
  coordinatorPhone: z.string().trim().max(30, "เบอร์ผู้ประสานงานยาวเกิน 30 ตัวอักษร").optional().nullable(),
  internalNote: z.string().trim().max(1000, "บันทึกภายในยาวเกิน 1000 ตัวอักษร").optional().nullable(),
  borrowedAt: bangkokDate.optional().nullable(),
  returnedAt: bangkokDate.optional().nullable(),
});

const EDITABLE = ["ACCEPTED", "IN_PROGRESS", "DONE"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await loadForAction(id, "manage");
    if (g.res) return g.res;
    const { r } = g;

    const parsed = schema.safeParse(await readBody(request));
    if (!parsed.success) return fail(parsed.error.issues[0].message, 400);
    const d = parsed.data;

    if (!EDITABLE.includes(r.status)) return fail(CONFLICT, 409);

    const data: Record<string, unknown> = {};
    for (const k of ["coordinatorName", "coordinatorPhone", "internalNote"] as const) {
      if (d[k] !== undefined) data[k] = d[k] || null;
    }
    for (const k of ["borrowedAt", "returnedAt"] as const) {
      if (d[k] !== undefined) data[k] = d[k];
    }
    const reassigned = d.assigneeId !== undefined && d.assigneeId !== r.assigneeId;
    if (reassigned) {
      const bad = await checkAssignee(d.assigneeId!, r.department as any);
      if (bad) return bad;
      data.assigneeId = d.assigneeId;
      data.assignedAt = new Date();
    }

    if (Object.keys(data).length > 0) {
      const { count } = await prisma.serviceRequest.updateMany({
        where: { id, status: r.status },
        data,
      });
      if (count === 0) return fail(CONFLICT, 409);
    }

    if (reassigned) logNotify(notifyAssigned(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating service request:", error);
    return fail(SERVER_ERROR, 500);
  }
}
