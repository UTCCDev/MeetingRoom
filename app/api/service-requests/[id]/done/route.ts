import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bangkokDate } from "@/lib/validation";
import { notifyDecision } from "@/lib/service-notify";
import { loadForAction, readBody, fail, logNotify, CONFLICT, SERVER_ERROR } from "@/lib/service-action";

const schema = z.object({ returnedAt: bangkokDate.optional().nullable() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await loadForAction(id, "work");
    if (g.res) return g.res;
    const { r } = g;

    const parsed = schema.safeParse(await readBody(request));
    if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

    if (r.status !== "IN_PROGRESS") return fail(CONFLICT, 409);
    const returnedAt = parsed.data.returnedAt ?? null;
    const needsReturn = r.items.some((i) => !i.otherText && i.catalogItem?.returnable);
    if (needsReturn && !returnedAt) return fail("กรุณาระบุวันที่คืนอุปกรณ์", 400);

    const { count } = await prisma.serviceRequest.updateMany({
      where: { id, status: "IN_PROGRESS" },
      data: { status: "DONE", returnedAt, decidedAt: new Date() },
    });
    if (count === 0) return fail(CONFLICT, 409);

    logNotify(notifyDecision(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error completing service request:", error);
    return fail(SERVER_ERROR, 500);
  }
}
