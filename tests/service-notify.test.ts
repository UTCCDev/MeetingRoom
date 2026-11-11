import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn() },
  serviceMember: { findMany: vi.fn() },
}));
const email = vi.hoisted(() => ({ sendServiceEmail: vi.fn(async () => {}) }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/email", () => email);

import { notifyNewRequest, notifyDecision, notifyAssigned, notifyCancelled } from "@/lib/service-notify";

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1", department: "AV", status: "PENDING", visibleAt: new Date(), location: "ห้อง 101",
  startTime: new Date("2026-11-20T02:00:00Z"), endTime: new Date("2026-11-20T04:00:00Z"),
  rejectionReason: null, contactPhone: "081", note: null,
  requester: { id: "u1", name: "สมชาย", email: "req@x" },
  assignee: { id: "u2", name: "ช่าง", email: "staff@x" },
  items: [{ qty: 2, otherText: null, catalogItem: { name: "ไมค์", returnable: true } }],
  booking: null, ...over,
});
const admins = [{ user: { id: "a1", name: "A", email: "adm1@x" } }, { user: { id: "a2", name: "B", email: "adm2@x" } }];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_URL = "http://app.test/";
  prisma.serviceRequest.findUnique.mockResolvedValue(row());
  prisma.serviceMember.findMany.mockResolvedValue(admins);
});

describe("service-notify", () => {
  it("new request emails active department admins with queue link", async () => {
    await notifyNewRequest("r1");
    expect(prisma.serviceMember.findMany.mock.calls[0][0].where).toMatchObject({
      department: "AV", role: "ADMIN", user: { active: true },
    });
    const [to, subject, lines, link] = email.sendServiceEmail.mock.calls[0] as any[];
    expect(to).toEqual(["adm1@x", "adm2@x"]);
    expect(subject).toContain("แผนกโสต");
    expect(lines.join("\n")).toContain("ไมค์");
    expect(link).toBe("http://app.test/services/av");
  });

  it("hidden request sends nothing to departments", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ visibleAt: null }));
    await notifyNewRequest("r1");
    await notifyCancelled("r1");
    expect(email.sendServiceEmail).not.toHaveBeenCalled();
  });

  it("decision goes to requester, subject by status, reason on reject", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "REJECTED", rejectionReason: "ไม่ว่าง" }));
    await notifyDecision("r1");
    const [to, subject, lines, link] = email.sendServiceEmail.mock.calls[0] as any[];
    expect(to).toEqual(["req@x"]);
    expect(subject).toContain("ปฏิเสธ");
    expect(lines.join("\n")).toContain("ไม่ว่าง");
    expect(link).toBe("http://app.test/services/mine");

    email.sendServiceEmail.mockClear();
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "DONE" }));
    await notifyDecision("r1");
    expect((email.sendServiceEmail.mock.calls[0] as any[])[1]).toContain("เสร็จสิ้น");

    email.sendServiceEmail.mockClear();
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "ACCEPTED" }));
    await notifyDecision("r1");
    expect((email.sendServiceEmail.mock.calls[0] as any[])[1]).toContain("รับ");
  });

  it("assigned goes to assignee with assigned link; skipped without assignee", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ department: "HOUSEKEEPING" }));
    await notifyAssigned("r1");
    const [to, , , link] = email.sendServiceEmail.mock.calls[0] as any[];
    expect(to).toEqual(["staff@x"]);
    expect(link).toBe("http://app.test/services/housekeeping/assigned");

    email.sendServiceEmail.mockClear();
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ assignee: null }));
    await notifyAssigned("r1");
    expect(email.sendServiceEmail).not.toHaveBeenCalled();
  });

  it("cancelled goes to admins plus assignee, deduped", async () => {
    prisma.serviceMember.findMany.mockResolvedValue([...admins, { user: { id: "u2", name: "ช่าง", email: "staff@x" } }]);
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "CANCELLED" }));
    await notifyCancelled("r1");
    expect((email.sendServiceEmail.mock.calls[0] as any[])[0].sort()).toEqual(["adm1@x", "adm2@x", "staff@x"]);
  });

  it("never throws when prisma or email fail", async () => {
    prisma.serviceRequest.findUnique.mockRejectedValue(new Error("db"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNewRequest("r1")).resolves.toBeUndefined();
    prisma.serviceRequest.findUnique.mockResolvedValue(row());
    email.sendServiceEmail.mockRejectedValueOnce(new Error("smtp"));
    await expect(notifyNewRequest("r1")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("missing request is a no-op", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(null);
    await notifyDecision("nope");
    expect(email.sendServiceEmail).not.toHaveBeenCalled();
  });
});
