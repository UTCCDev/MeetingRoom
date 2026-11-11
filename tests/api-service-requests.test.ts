import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  serviceMember: { findMany: vi.fn() },
  booking: { findUnique: vi.fn() },
  serviceCatalogItem: { findMany: vi.fn() },
  serviceRequest: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
}));
const fsp = vi.hoisted(() => ({ unlink: vi.fn(async (_p: string) => {}) }));
const session = vi.hoisted(() => ({ value: { user: { id: "u1" } } as any }));
const notify = vi.hoisted(() => ({ notifyNewRequest: vi.fn(async () => {}) }));
const files = vi.hoisted(() => ({
  saveServiceFiles: vi.fn(async () => [] as any[]),
  UploadError: class UploadError extends Error {},
}));

vi.mock("fs/promises", () => ({ ...fsp, default: fsp }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/service-notify", () => notify);
vi.mock("@/lib/service-attachments", () => files);

import { GET as LIST, POST } from "@/app/api/service-requests/route";
import { GET as ONE } from "@/app/api/service-requests/[id]/route";
import { GET as CATALOG } from "@/app/api/service-catalog/route";

const as = (id: string) => (session.value = { user: { id } });
let members: Record<string, { department: string; role: string }[]>;
const day = 86400_000;
const at = (d: number, h = 0) => new Date(Date.now() + d * day + h * 3600_000).toISOString();

const payload = (over: Record<string, unknown> = {}) => ({
  department: "AV",
  location: "ห้องประชุม 1",
  startTime: at(5),
  endTime: at(5, 2),
  contactPhone: "0812345678",
  items: [{ catalogItemId: "c1", qty: 2 }],
  ...over,
});
const call = (data: unknown) => {
  const fd = new FormData();
  fd.set("data", JSON.stringify(data));
  return POST(new Request("http://x/api/service-requests", { method: "POST", body: fd }) as any);
};
const created = () => prisma.serviceRequest.create.mock.calls[0][0].data;

const booking = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  userId: "u1",
  bookedForId: null,
  status: "APPROVED",
  startTime: new Date(Date.now() + 5 * day),
  endTime: new Date(Date.now() + 5 * day + 3600_000),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  members = {};
  as("u1");
  prisma.user.findUnique.mockImplementation(async ({ where }: any) => ({
    id: where.id, role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false,
  }));
  prisma.serviceMember.findMany.mockImplementation(async ({ where }: any) => members[where.userId] ?? []);
  prisma.serviceCatalogItem.findMany.mockResolvedValue([{ id: "c1" }]);
  prisma.booking.findUnique.mockResolvedValue(booking());
  prisma.serviceRequest.findFirst.mockResolvedValue(null);
  prisma.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
  prisma.serviceRequest.create.mockImplementation(async ({ data }: any) => ({ id: "s1", ...data }));
});

describe("POST /api/service-requests", () => {
  it("rejects a request inside the lead time", async () => {
    const res = await call(payload({ startTime: at(1), endTime: at(1, 2) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ต้องขอล่วงหน้าอย่างน้อย 3 วันก่อนวันใช้งาน");
    expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("creates a standalone request, visible now, and notifies", async () => {
    const res = await call(payload());
    expect(res.status).toBe(201);
    expect(created()).toMatchObject({ requesterId: "u1", createdById: "u1", department: "AV", bookingId: null });
    expect(created().visibleAt).toBeInstanceOf(Date);
    expect(notify.notifyNewRequest).toHaveBeenCalledWith("s1");
  });

  it("AV admin filing on behalf skips lead time and sets requesterId/createdById", async () => {
    as("avadmin");
    members.avadmin = [{ department: "AV", role: "ADMIN" }];
    const res = await call(payload({ requesterId: "u2", startTime: at(1), endTime: at(1, 2) }));
    expect(res.status).toBe(201);
    expect(created()).toMatchObject({ requesterId: "u2", createdById: "avadmin" });
  });

  it("non-admin requesterId → 403", async () => {
    const res = await call(payload({ requesterId: "u2" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("คุณไม่มีสิทธิ์ยื่นคำร้องแทนผู้อื่น");
  });

  it("booking PENDING → visibleAt null, no notify", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ status: "PENDING" }));
    const res = await call(payload({ bookingId: "b1", location: undefined, startTime: undefined, endTime: undefined }));
    expect(res.status).toBe(201);
    expect(created().visibleAt).toBeNull();
    expect(created().bookingId).toBe("b1");
    expect(notify.notifyNewRequest).not.toHaveBeenCalled();
  });

  it("booking APPROVED → visibleAt set, times copied from booking", async () => {
    const b = booking();
    prisma.booking.findUnique.mockResolvedValue(b);
    await call(payload({ bookingId: "b1", startTime: undefined, endTime: undefined }));
    expect(created().visibleAt).toBeInstanceOf(Date);
    expect(created().startTime).toEqual(b.startTime);
    expect(notify.notifyNewRequest).toHaveBeenCalledWith("s1");
  });

  it("booking approved during create → visibleAt set conditionally and notified", async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(booking({ status: "PENDING" }))
      .mockResolvedValueOnce(booking({ status: "APPROVED" }));
    const res = await call(payload({ bookingId: "b1", location: undefined, startTime: undefined, endTime: undefined }));
    expect(res.status).toBe(201);
    const arg = prisma.serviceRequest.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "s1", visibleAt: null });
    expect(arg.data.visibleAt).toBeInstanceOf(Date);
    expect(notify.notifyNewRequest).toHaveBeenCalledWith("s1");
  });

  it("booking approved during create but row already visible (count 0) → no notify", async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(booking({ status: "PENDING" }))
      .mockResolvedValueOnce(booking({ status: "APPROVED" }));
    prisma.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
    await call(payload({ bookingId: "b1", location: undefined, startTime: undefined, endTime: undefined }));
    expect(notify.notifyNewRequest).not.toHaveBeenCalled();
  });

  it("booking cancelled during create → row cancelled, no notify", async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(booking({ status: "PENDING" }))
      .mockResolvedValueOnce(booking({ status: "CANCELLED" }));
    const res = await call(payload({ bookingId: "b1", location: undefined, startTime: undefined, endTime: undefined }));
    expect(res.status).toBe(201);
    const arg = prisma.serviceRequest.updateMany.mock.calls[0][0];
    expect(arg.data.status).toBe("CANCELLED");
    expect(arg.data.cancelledAt).toBeInstanceOf(Date);
    expect(notify.notifyNewRequest).not.toHaveBeenCalled();
  });

  it("re-check failure never fails the response", async () => {
    prisma.booking.findUnique.mockResolvedValueOnce(booking({ status: "PENDING" })).mockRejectedValueOnce(new Error("db"));
    const res = await call(payload({ bookingId: "b1", location: undefined, startTime: undefined, endTime: undefined }));
    expect(res.status).toBe(201);
  });

  it("DB create failure (P2002) unlinks saved files", async () => {
    files.saveServiceFiles.mockResolvedValueOnce([{ fileName: "a.pdf" }, { fileName: "b.png" }] as any);
    prisma.serviceRequest.create.mockRejectedValue({ code: "P2002" });
    const res = await call(payload({ bookingId: "b1" }));
    expect(res.status).toBe(409);
    expect(fsp.unlink).toHaveBeenCalledTimes(2);
    expect(String(fsp.unlink.mock.calls[0][0])).toContain("a.pdf");
  });

  it("someone else's booking → 404", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ userId: "other" }));
    const res = await call(payload({ bookingId: "b1" }));
    expect(res.status).toBe(404);
  });

  it("duplicate (booking, department) → 409", async () => {
    prisma.serviceRequest.create.mockRejectedValue({ code: "P2002" });
    const res = await call(payload({ bookingId: "b1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("การจองนี้มีคำร้องแผนกโสตอยู่แล้ว");
  });

  it("inactive / other-department catalog item → 400", async () => {
    prisma.serviceCatalogItem.findMany.mockResolvedValue([]);
    const res = await call(payload());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("รายการอุปกรณ์ไม่ถูกต้อง");
    expect(prisma.serviceCatalogItem.findMany.mock.calls[0][0].where).toMatchObject({ active: true, department: "AV" });
  });

  it("upload error → 400 with its message, nothing created", async () => {
    files.saveServiceFiles.mockRejectedValueOnce(new files.UploadError("ไฟล์ใหญ่เกิน 5 MB"));
    const res = await call(payload());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ไฟล์ใหญ่เกิน 5 MB");
    expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("signed out → 401", async () => {
    session.value = null;
    expect((await call(payload())).status).toBe(401);
  });
});

describe("GET /api/service-requests", () => {
  const list = (qs: string) => LIST(new Request(`http://x/api/service-requests?${qs}`) as any);
  beforeEach(() =>
    prisma.serviceRequest.findMany.mockResolvedValue([
      { id: "s1", status: "PENDING", visibleAt: null },
      { id: "s2", status: "ACCEPTED", visibleAt: new Date() },
    ])
  );

  it("invalid status → 400", async () => {
    const res = await list("scope=mine&status=BOGUS");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("สถานะไม่ถูกต้อง");
    expect(prisma.serviceRequest.findMany).not.toHaveBeenCalled();
  });

  it("scope=mine and scope=booking omit internalNote; queue keeps it", async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([{ id: "s1", status: "PENDING", visibleAt: null, internalNote: "secret" }]);
    expect((await (await list("scope=mine")).json())[0]).not.toHaveProperty("internalNote");
    prisma.booking.findUnique.mockResolvedValue(booking());
    expect((await (await list("scope=booking&bookingId=b1")).json())[0]).not.toHaveProperty("internalNote");
    as("avadmin");
    members.avadmin = [{ department: "AV", role: "ADMIN" }];
    expect((await (await list("scope=queue&dept=AV")).json())[0].internalNote).toBe("secret");
  });

  it("scope=mine filters by requester and flags waitingRoom", async () => {
    const res = await list("scope=mine");
    expect(prisma.serviceRequest.findMany.mock.calls[0][0].where).toMatchObject({ requesterId: "u1" });
    const rows = await res.json();
    expect(rows.map((r: any) => r.waitingRoom)).toEqual([true, false]);
  });

  describe("scope=booking", () => {
    it("booker gets the rows", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      const res = await list("scope=booking&bookingId=b1");
      expect(res.status).toBe(200);
      expect(prisma.serviceRequest.findMany.mock.calls[0][0].where).toEqual({ bookingId: "b1" });
      expect((await res.json()).map((r: any) => r.waitingRoom)).toEqual([true, false]);
    });
    it("beneficiary gets the rows", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking({ userId: "other", bookedForId: "u1" }));
      expect((await list("scope=booking&bookingId=b1")).status).toBe(200);
    });
    it("stranger gets 404", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking({ userId: "other", bookedForId: "x" }));
      expect((await list("scope=booking&bookingId=b1")).status).toBe(404);
      expect(prisma.serviceRequest.findMany).not.toHaveBeenCalled();
    });
    it("missing bookingId gets 400", async () => {
      expect((await list("scope=booking")).status).toBe(400);
    });
  });

  it("queue without membership → 403", async () => {
    expect((await list("scope=queue&dept=AV")).status).toBe(403);
  });

  it("queue as AV STAFF restricts to own assignments", async () => {
    as("staff");
    members.staff = [{ department: "AV", role: "STAFF" }];
    await list("scope=queue&dept=AV&status=PENDING");
    expect(prisma.serviceRequest.findMany.mock.calls[0][0].where).toMatchObject({
      department: "AV", assigneeId: "staff", visibleAt: { not: null }, status: "PENDING",
    });
  });
});

describe("GET /api/service-requests/[id]", () => {
  const one = () => ONE(new Request("http://x") as any, { params: Promise.resolve({ id: "s1" }) });
  const row = (over = {}) => ({
    id: "s1", requesterId: "u1", department: "AV", visibleAt: null, assigneeId: null,
    items: [], attachments: [{ id: "a1", fileName: "f.pdf" }], ...over,
  });

  it("AV admin on a hidden request → 404", async () => {
    as("avadmin");
    members.avadmin = [{ department: "AV", role: "ADMIN" }];
    prisma.serviceRequest.findUnique.mockResolvedValue(row());
    expect((await one()).status).toBe(404);
  });

  it("requester's GET has no internalNote; dept admin's has it", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ internalNote: "secret" }));
    expect(await (await one()).json()).not.toHaveProperty("internalNote");
    as("avadmin");
    members.avadmin = [{ department: "AV", role: "ADMIN" }];
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ internalNote: "secret", visibleAt: new Date() }));
    expect((await (await one()).json()).internalNote).toBe("secret");
  });

  it("requester sees it, attachments get urls", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row());
    const res = await one();
    expect(res.status).toBe(200);
    expect((await res.json()).attachments[0].url).toBe("/api/service-requests/s1/attachments/f.pdf");
  });
});

describe("GET /api/service-catalog", () => {
  it("returns active items ordered by sortOrder", async () => {
    prisma.serviceCatalogItem.findMany.mockResolvedValue([{ id: "c1" }]);
    const res = await CATALOG(new Request("http://x/api/service-catalog?dept=AV") as any);
    expect(res.status).toBe(200);
    const arg = prisma.serviceCatalogItem.findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ active: true, department: "AV" });
    expect(arg.orderBy).toEqual({ sortOrder: "asc" });
  });

  it("signed out → 401", async () => {
    session.value = null;
    expect((await CATALOG(new Request("http://x/api/service-catalog?dept=AV") as any)).status).toBe(401);
  });
});
