import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ serviceRequest: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { serviceNotifications } from "@/lib/service-notifications";

const HOUR = 3600_000;
const now = new Date("2026-11-11T05:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * HOUR);
const ahead = (h: number) => new Date(now.getTime() + h * HOUR);

const req = (over: Record<string, unknown> = {}) => ({
  id: "r1", department: "AV", status: "PENDING", requesterId: "req", assigneeId: null,
  startTime: ahead(72), endTime: ahead(75), location: "ห้อง 101", bookingId: null,
  visibleAt: ago(1), assignedAt: null, decidedAt: null, cancelledAt: null, rejectionReason: null,
  requester: { id: "req", name: "สมชาย", email: "a@x" }, items: [], ...over,
});

// Each role query is distinguished by the where clause it uses.
function rows(byRole: { admin?: any[]; assignee?: any[]; requester?: any[] }) {
  prisma.serviceRequest.findMany.mockImplementation(async ({ where }: any) => {
    if (where.requesterId) return byRole.requester ?? [];
    if (where.assigneeId) return byRole.assignee ?? [];
    return byRole.admin ?? [];
  });
}
const adminMs = [{ department: "AV", role: "ADMIN" }] as any;
const types = (items: any[]) => items.map((i) => i.type);

beforeEach(() => {
  vi.clearAllMocks();
  rows({});
});

describe("serviceNotifications", () => {
  it("admin gets svc_new only for visible PENDING", async () => {
    rows({ admin: [req(), req({ id: "r2", status: "ACCEPTED" }), req({ id: "r3", visibleAt: null })] });
    const out = await serviceNotifications("adm", adminMs, now);
    expect(out.map((i) => i.id)).toEqual(["svc_new:r1"]);
    expect(out[0].service).toMatchObject({ requestId: "r1", department: "AV", deptLabel: "แผนกโสต", requesterName: "สมชาย" });
  });

  it("hidden request yields nothing", async () => {
    rows({
      admin: [req({ visibleAt: null }), req({ id: "r2", visibleAt: null, status: "CANCELLED", cancelledAt: ago(1) })],
    });
    expect(await serviceNotifications("adm", adminMs, now)).toEqual([]);
  });

  it("admin gets svc_cancelled when visible", async () => {
    rows({ admin: [req({ status: "CANCELLED", cancelledAt: ago(2) })] });
    expect(types(await serviceNotifications("adm", adminMs, now))).toEqual(["svc_cancelled"]);
  });

  it("overdue only with returnable item, IN_PROGRESS and past end", async () => {
    const ret = [{ catalogItem: { returnable: true } }];
    const non = [{ catalogItem: { returnable: false } }];
    rows({
      admin: [
        req({ id: "a", status: "IN_PROGRESS", endTime: ago(1), items: ret }),
        req({ id: "b", status: "IN_PROGRESS", endTime: ago(1), items: non }),
        req({ id: "c", status: "IN_PROGRESS", endTime: ahead(1), items: ret }),
        req({ id: "d", status: "DONE", endTime: ago(1), items: ret }),
      ],
    });
    expect((await serviceNotifications("adm", adminMs, now)).map((i) => i.id)).toEqual(["svc_overdue:a"]);
  });

  it("staff gets svc_soon within 24h only", async () => {
    rows({
      assignee: [
        req({ id: "a", status: "ACCEPTED", assigneeId: "st", startTime: ahead(10) }),
        req({ id: "b", status: "ACCEPTED", assigneeId: "st", startTime: ahead(30) }),
        req({ id: "c", status: "PENDING", assigneeId: "st", startTime: ahead(10) }),
      ],
    });
    const out = await serviceNotifications("st", [{ department: "AV", role: "STAFF" }] as any, now);
    expect(out.map((i) => i.id)).toEqual(["svc_soon:a"]);
  });

  it("assignee gets svc_assigned and svc_cancelled", async () => {
    rows({
      assignee: [
        req({ id: "a", status: "ACCEPTED", assigneeId: "st", assignedAt: ago(2) }),
        req({ id: "b", status: "CANCELLED", assigneeId: "st", cancelledAt: ago(3) }),
      ],
    });
    const out = await serviceNotifications("st", [], now);
    expect(out.map((i) => i.id).sort()).toEqual(["svc_assigned:a", "svc_cancelled:b"]);
  });

  it("requester svc_rejected carries reason; accepted/done too", async () => {
    rows({
      requester: [
        req({ id: "a", status: "REJECTED", decidedAt: ago(1), rejectionReason: "ไม่ว่าง" }),
        req({ id: "b", status: "ACCEPTED", decidedAt: ago(2) }),
        req({ id: "c", status: "DONE", decidedAt: ago(3) }),
        req({ id: "d", status: "PENDING" }),
      ],
    });
    const out = await serviceNotifications("req", [], now);
    expect(types(out)).toEqual(["svc_rejected", "svc_accepted", "svc_done"]);
    expect(out[0].service?.reason).toBe("ไม่ว่าง");
  });

  it("sorts newest first, dedupes, and caps at 40", async () => {
    const many = Array.from({ length: 50 }, (_, i) => req({ id: `r${i}`, visibleAt: ago(i + 1) }));
    rows({ admin: many });
    const out = await serviceNotifications("adm", adminMs, now);
    expect(out).toHaveLength(40);
    expect(out[0].id).toBe("svc_new:r0");
  });
});
