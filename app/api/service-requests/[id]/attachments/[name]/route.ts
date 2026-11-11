import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { canViewRequest } from "@/lib/service-rules";
import { SERVICE_UPLOAD_DIR, SERVICE_UPLOAD_NAME } from "@/lib/uploads";

const notFound = () => NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });

// GET a service-request attachment, only for people who can view the request.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const session = await getServerSession(authOptions);
  const actor = await loadServiceActor(session as any);
  if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id, name } = await params;
  if (!SERVICE_UPLOAD_NAME.test(name)) return notFound();

  const att = await prisma.serviceAttachment.findFirst({
    where: { fileName: name, requestId: id },
    include: { request: true },
  });
  if (!att || !canViewRequest(actor.id, actor.memberships, att.request)) return notFound();

  try {
    const bytes = await readFile(path.join(SERVICE_UPLOAD_DIR, name));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": att.mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
