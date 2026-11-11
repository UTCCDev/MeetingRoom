import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  serviceMember: { findMany: vi.fn(), findFirst: vi.fn() },
  serviceRequest: { findUnique: vi.fn(), updateMany: vi.fn() },
}));
const session = vi.hoisted(() => ({ value: { user: { id: "u1" } } as any }));
const notify = vi.hoisted(() => ({
  notifyDecision: vi.fn(async () => {}),
  notifyAssigned: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/service-notify", () => notify);

import { POST as ACCEPT } from "@/app/api/service-requests/[id]/accept/route";
import { POST as REJECT } from "@/app/api/service-requests/[id]/reject/route";
import { POST as PROGRESS } from "@/app/api/service-requests/[id]/progress/route";
import { POST as DONE } from "@/app/api/service-requests/[id]/done/route";
import { POST as UPDATE } from "@/app/api/service-requests/[id]/update/route";

const as = (id: string) => (session.value = { user: { id } });
let members: Record<string, { department: string; role: string }[]>;
const call = (fn: any, body: unknown = {}) =>
  fn(
    new Request("http://x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }) as any,
    { params: Promise.resolve({ id: "s1" }) }
  );
const row = (over: Record<string, unknown> = {}) => ({
  id: "s1", department: "AV", status: "PENDING", requesterId: "u1", visibleAt: new Date(),
  assigneeId: null, items: [], ...over,
});
const updated = () => prisma.serviceRequest.updateMany.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  members = { admin: [{ department: "AV", role: "ADMIN" }], staff: [{ department: "AV", role: "STAFF" }], staff2: [{ department: "AV", role: "STAFF" }] };
  as("admin");
  prisma.user.findUnique.mockImplementation(async ({ where }: any) => ({
    id: where.id, role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false,
  }));
  prisma.serviceMember.findMany.mockImplementation(async ({ where }: any) => members[where.userId] ?? []);
  prisma.serviceMember.findFirst.mockResolvedValue({ id: "m1" });
  prisma.serviceRequest.findUnique.mockResolvedValue(row());
  prisma.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
});

describe("accept", () => {
  it("without assignee → 400", async () => {
    expect((await call(ACCEPT, {})).status).toBe(400);
    expect(prisma.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("assignee not in dept → 400", async () => {
    prisma.serviceMember.findFirst.mockResolvedValue(null);
    const res = await call(ACCEPT, { assigneeId: "x" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ผู้รับผิดชอบต้องเป็นเจ้าหน้าที่ของแผนกโสต");
  });

  it("inactive assignee is rejected with 400 (lookup requires active user)", async () => {
    prisma.serviceMember.findFirst.mockResolvedValue(null);
    expect((await call(ACCEPT, { assigneeId: "gone" })).status).toBe(400);
    expect(prisma.serviceMember.findFirst.mock.calls[0][0].where.user).toEqual({ active: true });
  });

  it("STAFF → 403", async () => {
    as("staff");
    const res = await call(ACCEPT, { assigneeId: "staff" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("คุณไม่มีสิทธิ์ดำเนินการนี้");
  });

  it("non-member → 404; hidden → 404", async () => {
    as("nobody");
    expect((await call(ACCEPT, { assigneeId: "staff" })).status).toBe(404);
    as("admin");
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ visibleAt: null }));
    expect((await call(ACCEPT, { assigneeId: "staff" })).status).toBe(404);
  });

  it("success sets fields conditionally and notifies", async () => {
    const res = await call(ACCEPT, { assigneeId: "staff", coordinatorName: "สมชาย" });
    expect(res.status).toBe(200);
    expect(updated().where).toEqual({ id: "s1", status: "PENDING" });
    expect(updated().data).toMatchObject({ status: "ACCEPTED", assigneeId: "staff", coordinatorName: "สมชาย" });
    expect(updated().data.assignedAt).toBeInstanceOf(Date);
    expect(updated().data.decidedAt).toBeInstanceOf(Date);
    expect(notify.notifyDecision).toHaveBeenCalledWith("s1");
    expect(notify.notifyAssigned).toHaveBeenCalledWith("s1");
  });

  it("concurrent accept (count 0) → 409", async () => {
    prisma.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = await call(ACCEPT, { assigneeId: "staff" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("คำร้องนี้ถูกเปลี่ยนสถานะแล้ว");
    expect(notify.notifyDecision).not.toHaveBeenCalled();
  });

  it("wrong current status → 409", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "ACCEPTED" }));
    expect((await call(ACCEPT, { assigneeId: "staff" })).status).toBe(409);
  });

  it("notify failure does not undo the change", async () => {
    notify.notifyDecision.mockRejectedValueOnce(new Error("boom"));
    expect((await call(ACCEPT, { assigneeId: "staff" })).status).toBe(200);
  });
});

describe("reject", () => {
  it("empty reason → 400", async () => {
    expect((await call(REJECT, { reason: "  " })).status).toBe(400);
  });
  it("rejects a pending request", async () => {
    const res = await call(REJECT, { reason: "ไม่มีอุปกรณ์" });
    expect(res.status).toBe(200);
    expect(updated().data).toMatchObject({ status: "REJECTED", rejectionReason: "ไม่มีอุปกรณ์" });
    expect(notify.notifyDecision).toHaveBeenCalledWith("s1");
  });
});

describe("progress", () => {
  beforeEach(() => prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "ACCEPTED", assigneeId: "staff" })));

  it("assignee STAFF → 200, borrowedAt defaults to now", async () => {
    as("staff");
    const res = await call(PROGRESS, {});
    expect(res.status).toBe(200);
    expect(updated().where).toEqual({ id: "s1", status: "ACCEPTED" });
    expect(updated().data.status).toBe("IN_PROGRESS");
    expect(updated().data.borrowedAt).toBeInstanceOf(Date);
    expect(updated().data).not.toHaveProperty("decidedAt");
  });
  it("other STAFF → 404", async () => {
    as("staff2");
    expect((await call(PROGRESS, {})).status).toBe(404);
  });
  it("wrong status → 409", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "PENDING" }));
    expect((await call(PROGRESS, {})).status).toBe(409);
  });
});

describe("done", () => {
  const withItems = (items: any[]) =>
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "IN_PROGRESS", assigneeId: "staff", items }));

  it("returnable item without returnedAt → 400", async () => {
    withItems([{ otherText: null, catalogItem: { returnable: true } }]);
    const res = await call(DONE, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("กรุณาระบุวันที่คืนอุปกรณ์");
  });
  it("returnable item with returnedAt → 200", async () => {
    withItems([{ otherText: null, catalogItem: { returnable: true } }]);
    const res = await call(DONE, { returnedAt: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(updated().data.status).toBe("DONE");
    expect(notify.notifyDecision).toHaveBeenCalledWith("s1");
  });
  it("only otherText items → no returnedAt needed", async () => {
    withItems([{ otherText: "x", catalogItem: null }]);
    expect((await call(DONE, {})).status).toBe(200);
  });
});

describe("update", () => {
  beforeEach(() => prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "ACCEPTED", assigneeId: "staff" })));

  it("PENDING → 409", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row());
    expect((await call(UPDATE, { internalNote: "x" })).status).toBe(409);
  });
  it("STAFF → 403", async () => {
    as("staff");
    expect((await call(UPDATE, { internalNote: "x" })).status).toBe(403);
  });
  it("edit note without status change, no notify", async () => {
    const res = await call(UPDATE, { internalNote: "แก้ไข" });
    expect(res.status).toBe(200);
    expect(updated().data).toEqual({ internalNote: "แก้ไข" });
    expect(notify.notifyAssigned).not.toHaveBeenCalled();
  });
  it("reassign sets assignedAt and notifies", async () => {
    const res = await call(UPDATE, { assigneeId: "staff2" });
    expect(res.status).toBe(200);
    expect(updated().data.assigneeId).toBe("staff2");
    expect(updated().data.assignedAt).toBeInstanceOf(Date);
    expect(notify.notifyAssigned).toHaveBeenCalledWith("s1");
  });
  it("assignee outside dept → 400", async () => {
    prisma.serviceMember.findFirst.mockResolvedValue(null);
    expect((await call(UPDATE, { assigneeId: "x" })).status).toBe(400);
  });
});
