import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyDecision } from "@/lib/service-notify";
import { loadForAction, readBody, fail, logNotify, CONFLICT, SERVER_ERROR } from "@/lib/service-action";

const schema = z.object({
  reason: z
    .string({ required_error: "กรุณาระบุเหตุผล" })
    .trim()
    .min(1, "กรุณาระบุเหตุผล")
    .max(500, "เหตุผลยาวเกิน 500 ตัวอักษร"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await loadForAction(id, "manage");
    if (g.res) return g.res;
    const { r } = g;

    const parsed = schema.safeParse(await readBody(request));
    if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

    if (r.status !== "PENDING") return fail(CONFLICT, 409);
    const { count } = await prisma.serviceRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", rejectionReason: parsed.data.reason, decidedAt: new Date() },
    });
    if (count === 0) return fail(CONFLICT, 409);

    logNotify(notifyDecision(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error rejecting service request:", error);
    return fail(SERVER_ERROR, 500);
  }
}
