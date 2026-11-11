import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bangkokDate } from "@/lib/validation";
import { loadForAction, readBody, fail, CONFLICT, SERVER_ERROR } from "@/lib/service-action";

const schema = z.object({ borrowedAt: bangkokDate.optional().nullable() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await loadForAction(id, "work");
    if (g.res) return g.res;
    const { r } = g;

    const parsed = schema.safeParse(await readBody(request));
    if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

    if (r.status !== "ACCEPTED") return fail(CONFLICT, 409);
    const now = new Date();
    const { count } = await prisma.serviceRequest.updateMany({
      where: { id, status: "ACCEPTED" },
      data: { status: "IN_PROGRESS", borrowedAt: parsed.data.borrowedAt ?? now },
    });
    if (count === 0) return fail(CONFLICT, 409);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error starting service request:", error);
    return fail(SERVER_ERROR, 500);
  }
}
