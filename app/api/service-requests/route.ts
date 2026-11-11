import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActor } from "@/lib/actor";
import { loadServiceActor } from "@/lib/service-actor";
import { UploadError, saveServiceFiles } from "@/lib/service-attachments";
import { notifyNewRequest } from "@/lib/service-notify";
import {
  DEPT_LABEL,
  canManage,
  createServiceSchema,
  meetsLeadTime,
  membershipIn,
  queueWhere,
  type Dept,
} from "@/lib/service-rules";
import { firstError } from "@/lib/validation";

const USER_PUBLIC = { select: { id: true, name: true, email: true } } as const;
const SERVER_ERROR = "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่";
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });
const isDept = (v: unknown): v is Dept => v === "AV" || v === "HOUSEKEEPING";

// POST multipart: field "data" (JSON) + "files" (attachments)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return bad("ไม่ได้รับอนุญาต", 401);

    const form = await request.formData().catch(() => null);
    if (!form) return bad("ข้อมูลไม่ถูกต้อง");
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("data") ?? ""));
    } catch {
      return bad("ข้อมูลไม่ถูกต้อง");
    }
    const parsed = createServiceSchema.safeParse(raw);
    if (!parsed.success) {
      return bad(firstError(parsed.error), 400, { field: parsed.error.issues[0]?.path[0] });
    }
    const data = parsed.data;
    const dept = data.department;
    const uploads = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);

    // On-behalf filing: department admins only. Naming yourself is a no-op.
    const onBehalf = !!data.requesterId && data.requesterId !== actor.id;
    if (onBehalf) {
      if (!canManage(actor.memberships, dept)) return bad("คุณไม่มีสิทธิ์ยื่นคำร้องแทนผู้อื่น", 403);
      const target = await loadActor({ user: { id: data.requesterId! } });
      if (!target) return bad("ไม่พบผู้ใช้ที่ต้องการยื่นแทน หรือบัญชีถูกปิดใช้งาน", 400, { field: "requesterId" });
    }
    const requesterId = onBehalf ? data.requesterId! : actor.id;

    const now = new Date();
    let startTime: Date;
    let endTime: Date;
    let visibleAt: Date | null = now;
    const bookingId = data.bookingId || null;

    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      const mine = (id: string) => booking && (booking.userId === id || booking.bookedForId === id);
      if (!booking || !(mine(requesterId) || mine(actor.id))) return bad("ไม่พบการจอง", 404);
      if (!["PENDING", "APPROVED"].includes(booking.status) || booking.endTime <= now) {
        return bad("การจองนี้ไม่สามารถขอบริการได้", 400);
      }
      startTime = booking.startTime;
      endTime = booking.endTime;
      visibleAt = booking.status === "APPROVED" ? now : null;
      if (await prisma.serviceRequest.findFirst({ where: { bookingId, department: dept } })) {
        return bad(`การจองนี้มีคำร้อง${DEPT_LABEL[dept]}อยู่แล้ว`, 409);
      }
    } else {
      startTime = data.startTime!;
      endTime = data.endTime!;
    }

    if (!onBehalf && !meetsLeadTime(startTime, now)) {
      return bad("ต้องขอล่วงหน้าอย่างน้อย 3 วันก่อนวันใช้งาน", 400, { field: "startTime" });
    }

    const catalogIds = [...new Set(data.items.map((i) => i.catalogItemId).filter((v): v is string => !!v))];
    if (catalogIds.length) {
      const found = await prisma.serviceCatalogItem.findMany({
        where: { id: { in: catalogIds }, department: dept, active: true },
        select: { id: true },
      });
      if (found.length !== catalogIds.length) return bad("รายการอุปกรณ์ไม่ถูกต้อง", 400, { field: "items" });
    }

    // Everything is validated; now store files, then the row.
    let saved;
    try {
      saved = await saveServiceFiles(uploads);
    } catch (err) {
      if (err instanceof UploadError) return bad(err.message);
      throw err;
    }

    let created;
    try {
      created = await prisma.serviceRequest.create({
        data: {
          department: dept,
          requesterId,
          createdById: actor.id,
          bookingId,
          location: bookingId ? null : data.location || null,
          startTime,
          endTime,
          contactPhone: data.contactPhone,
          note: data.note || null,
          visibleAt,
          items: {
            create: data.items.map((i) => ({
              catalogItemId: i.catalogItemId || null,
              otherText: i.catalogItemId ? null : i.otherText || null,
              qty: i.qty,
            })),
          },
          attachments: { create: saved },
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") return bad(`การจองนี้มีคำร้อง${DEPT_LABEL[dept]}อยู่แล้ว`, 409);
      throw err;
    }

    if (visibleAt) {
      // Not awaited: a slow mail server must not delay the request.
      notifyNewRequest(created.id).catch((err) => console.error("Service request notify failed:", err));
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating service request:", error);
    return bad(SERVER_ERROR, 500);
  }
}

// GET ?scope=mine|queue&dept=AV&status=PENDING&from=&to=
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const actor = await loadServiceActor(session as any);
    if (!actor) return bad("ไม่ได้รับอนุญาต", 401);

    const sp = new URL(request.url).searchParams;
    const scope = sp.get("scope") ?? "mine";
    let where: Record<string, unknown>;
    if (scope === "queue") {
      const dept = sp.get("dept");
      if (!isDept(dept)) return bad("แผนกไม่ถูกต้อง");
      const m = membershipIn(actor.memberships, dept);
      if (!m) return bad("คุณไม่มีสิทธิ์ดูคิวของแผนกนี้", 403);
      where = queueWhere(actor.id, m);
    } else if (scope === "mine") {
      where = { requesterId: actor.id };
    } else {
      return bad("scope ไม่ถูกต้อง");
    }

    const status = sp.get("status");
    if (status) where.status = status;
    const range: Record<string, Date> = {};
    for (const [key, op] of [["from", "gte"], ["to", "lte"]] as const) {
      const v = sp.get(key);
      if (!v) continue;
      const d = new Date(v);
      if (isNaN(d.getTime())) return bad("รูปแบบวันที่ไม่ถูกต้อง");
      range[op] = d;
    }
    if (Object.keys(range).length) where.startTime = range;

    const rows = await prisma.serviceRequest.findMany({
      where,
      include: {
        items: { include: { catalogItem: { select: { name: true } } } },
        requester: USER_PUBLIC,
        assignee: USER_PUBLIC,
        booking: { select: { id: true, title: true, room: { select: { name: true } } } },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(rows.map((r) => ({ ...r, waitingRoom: r.visibleAt === null && r.status === "PENDING" })));
  } catch (error) {
    console.error("Error listing service requests:", error);
    return bad(SERVER_ERROR, 500);
  }
}
