import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  serviceMember: { findMany: vi.fn() },
  serviceRequest: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
}));
const session = vi.hoisted(() => ({ value: { user: { id: "u1" } } as any }));
const notify = vi.hoisted(() => ({
  notifyNewRequest: vi.fn(async () => {}),
  notifyCancelled: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/service-notify", () => notify);

import { onBookingApprovedServices, onBookingClosedServices } from "@/lib/service-booking-sync";
import { POST as CANCEL } from "@/app/api/service-requests/[id]/cancel/route";

const HOUR = 3600_000;
const call = () => CANCEL(new Request("http://x", { method: "POST" }) as any, { params: Promise.resolve({ id: "s1" }) });
const row = (over: Record<string, unknown> = {}) => ({
  id: "s1", status: "PENDING", requesterId: "u1", visibleAt: new Date(), startTime: new Date(Date.now() + 48 * HOUR), ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  session.value = { user: { id: "u1" } };
  prisma.user.findUnique.mockImplementation(async ({ where }: any) => ({
    id: where.id, role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false,
  }));
  prisma.serviceMember.findMany.mockResolvedValue([]);
  prisma.serviceRequest.findUnique.mockResolvedValue(row());
  prisma.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
  prisma.serviceRequest.findMany.mockResolvedValue([]);
});

describe("requester cancel", () => {
  it("not signed in -> 401", async () => {
    session.value = null;
    expect((await call()).status).toBe(401);
  });

  it("stranger -> 404", async () => {
    session.value = { user: { id: "other" } };
    expect((await call()).status).toBe(404);
    expect(prisma.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("ACCEPTED 23h before start -> 409 with cutoff message", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ status: "ACCEPTED", startTime: new Date(Date.now() + 23 * HOUR) }));
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("ยกเลิกได้ถึง 24 ชม. ก่อนเวลาใช้งาน กรุณาติดต่อเจ้าหน้าที่");
    expect(prisma.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("PENDING visible -> cancelled, cancelledAt set, notified", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const arg = prisma.serviceRequest.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "s1", status: "PENDING" });
    expect(arg.data.status).toBe("CANCELLED");
    expect(arg.data.cancelledAt).toBeInstanceOf(Date);
    expect(notify.notifyCancelled).toHaveBeenCalledWith("s1");
  });

  it("hidden request (visibleAt null) -> cancelled without notification", async () => {
    prisma.serviceRequest.findUnique.mockResolvedValue(row({ visibleAt: null }));
    expect((await call()).status).toBe(200);
    expect(notify.notifyCancelled).not.toHaveBeenCalled();
  });

  it("lost race -> 409", async () => {
    prisma.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("คำร้องนี้ถูกเปลี่ยนสถานะแล้ว");
    expect(notify.notifyCancelled).not.toHaveBeenCalled();
  });
});

describe("onBookingApprovedServices", () => {
  it("sets visibleAt on hidden PENDING requests and notifies each", async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await onBookingApprovedServices("b1");
    const arg = prisma.serviceRequest.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ bookingId: "b1", status: "PENDING", visibleAt: null });
    expect(arg.data.visibleAt).toBeInstanceOf(Date);
    expect(notify.notifyNewRequest).toHaveBeenCalledTimes(2);
    expect(notify.notifyNewRequest).toHaveBeenCalledWith("a");
  });

  it("never throws", async () => {
    prisma.serviceRequest.findMany.mockRejectedValue(new Error("db"));
    await expect(onBookingApprovedServices("b1")).resolves.toBeUndefined();
  });
});

describe("onBookingClosedServices", () => {
  it("reject: cancels PENDING/ACCEPTED silently (hidden requests)", async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([{ id: "a", visibleAt: null }]);
    await onBookingClosedServices("b1", "REJECTED");
    const arg = prisma.serviceRequest.updateMany.mock.calls[0][0];
    expect(arg.where.bookingId).toBe("b1");
    expect(arg.where.status).toEqual({ in: ["PENDING", "ACCEPTED"] });
    expect(arg.data.status).toBe("CANCELLED");
    expect(arg.data.cancelledAt).toBeInstanceOf(Date);
    expect(notify.notifyCancelled).not.toHaveBeenCalled();
  });

  it("cancel after approval notifies visible requests only", async () => {
    prisma.serviceRequest.findMany.mockResolvedValue([
      { id: "a", visibleAt: new Date() },
      { id: "b", visibleAt: null },
    ]);
    await onBookingClosedServices("b1", "CANCELLED");
    expect(notify.notifyCancelled).toHaveBeenCalledTimes(1);
    expect(notify.notifyCancelled).toHaveBeenCalledWith("a");
  });

  it("leaves IN_PROGRESS/DONE/REJECTED alone", async () => {
    await onBookingClosedServices("b1", "CANCELLED");
    expect(prisma.serviceRequest.findMany.mock.calls[0][0].where.status).toEqual({ in: ["PENDING", "ACCEPTED"] });
  });

  it("never throws", async () => {
    prisma.serviceRequest.findMany.mockRejectedValue(new Error("db"));
    await expect(onBookingClosedServices("b1", "CANCELLED")).resolves.toBeUndefined();
  });
});
