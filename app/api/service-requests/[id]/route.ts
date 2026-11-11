import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadServiceActor } from "@/lib/service-actor";
import { canViewRequest } from "@/lib/service-rules";

const USER_PUBLIC = { select: { id: true, name: true, email: true } } as const;
const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const NOT_FOUND = "ไม่พบคำร้อง";

// GET one request. Anyone who may not view it gets 404, so hidden requests are not revealed.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });

    const r = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        items: { include: { catalogItem: { select: { name: true, returnable: true } } } },
        attachments: true,
        requester: USER_PUBLIC,
        assignee: USER_PUBLIC,
        booking: { select: { id: true, title: true, room: { select: { name: true } } } },
      },
    });
    if (!r || !canViewRequest(actor.id, actor.memberships, r as any)) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json({
      ...r,
      waitingRoom: r.visibleAt === null && r.status === "PENDING",
      attachments: r.attachments.map((a) => ({
        ...a,
        url: `/api/service-requests/${r.id}/attachments/${a.fileName}`,
      })),
    });
  } catch (error) {
    console.error("Error fetching service request:", error);
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
