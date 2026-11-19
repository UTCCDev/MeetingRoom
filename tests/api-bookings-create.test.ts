import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  room: { findUnique: vi.fn() },
  booking: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
}));
const session = vi.hoisted(() => ({ value: { user: { id: "u1" } } as any }));
const email = vi.hoisted(() => ({ sendApprovalRequest: vi.fn(async () => {}) }));
const approval = vi.hoisted(() => ({ onBookingApproved: vi.fn(async () => {}) }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/email", () => email);
vi.mock("@/lib/booking-approval", () => approval);

import { POST } from "@/app/api/bookings/route";

type U = { id: string; role?: string; active?: boolean; isPresidentApprover?: boolean; autoApproveBooking?: boolean };
let users: Record<string, U>;
const user = (u: U) => ({ role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false, name: u.id, email: `${u.id}@utcc.ac.th`, ...u });

const room = (over = {}) => ({
  id: "r1",
  name: "ห้อง A",
  capacity: 20,
  status: true,
  roomAdminId: "admin1",
  requiresPresidentApproval: false,
  roomAdmin: { id: "admin1", email: "admin1@utcc.ac.th" },
  approvers: [],
  ...over,
});

const future = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const body = (over = {}) => ({ roomId: "r1", title: "ประชุม", attendees: 5, startTime: future(24), endTime: future(25), ...over });
const call = (b: unknown) =>
  POST(new Request("http://x/api/bookings", { method: "POST", body: JSON.stringify(b) }) as any);

beforeEach(() => {
  vi.clearAllMocks();
  users = { u1: user({ id: "u1" }), u2: user({ id: "u2" }) };
  prisma.user.findUnique.mockImplementation(async ({ where }: any) => (users[where.id] ? user(users[where.id]) : null));
  prisma.user.findMany.mockResolvedValue([{ email: "pres@utcc.ac.th" }]);
  prisma.room.findUnique.mockResolvedValue(room());
  prisma.booking.findFirst.mockResolvedValue(null);
  prisma.booking.create.mockImplementation(async ({ data }: any) => ({ id: "b1", ...data, user: { name: "u1" } }));
});

const created = () => prisma.booking.create.mock.calls[0][0].data;

describe("POST /api/bookings", () => {
  it("plain USER creates PENDING and notifies the room admin", async () => {
    const res = await call(body());
    expect(res.status).toBe(201);
    expect(created().status).toBe("PENDING");
    expect((email.sendApprovalRequest.mock.calls[0] as any[])[0]).toEqual(["admin1@utcc.ac.th"]);
    expect(approval.onBookingApproved).not.toHaveBeenCalled();
  });

  it("booker with autoApproveBooking is APPROVED immediately", async () => {
    users.u1.autoApproveBooking = true;
    await call(body());
    expect(created()).toMatchObject({ status: "APPROVED", autoApproved: true, approvedById: "u1" });
    expect(approval.onBookingApproved).toHaveBeenCalledWith("b1");
  });

  it("beneficiary with autoApproveBooking makes it APPROVED", async () => {
    users.u2.autoApproveBooking = true;
    await call(body({ bookedForId: "u2" }));
    expect(created()).toMatchObject({ status: "APPROVED", bookedForId: "u2" });
  });

  it("president room: booker with both flags is APPROVED", async () => {
    prisma.room.findUnique.mockResolvedValue(room({ requiresPresidentApproval: true }));
    Object.assign(users.u1, { role: "ROOM_ADMIN", autoApproveBooking: true, isPresidentApprover: true });
    await call(body());
    expect(created().status).toBe("APPROVED");
  });

  it("president room: auto flag only stays PENDING and notifies president approvers", async () => {
    prisma.room.findUnique.mockResolvedValue(room({ requiresPresidentApproval: true }));
    users.u1.autoApproveBooking = true;
    await call(body());
    expect(created().status).toBe("PENDING");
    expect((email.sendApprovalRequest.mock.calls[0] as any[])[0]).toEqual(["pres@utcc.ac.th"]);
  });

  it("president room with no president approver logs a warning", async () => {
    prisma.room.findUnique.mockResolvedValue(room({ requiresPresidentApproval: true }));
    prisma.user.findMany.mockResolvedValue([]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await call(body());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("president approver"));
    warn.mockRestore();
  });

  it("auto-approved booking still gets 409 on overlap", async () => {
    users.u1.autoApproveBooking = true;
    prisma.booking.findFirst.mockResolvedValue({ id: "other" });
    const res = await call(body());
    expect(res.status).toBe(409);
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("unknown beneficiary → 400 on bookedForId", async () => {
    const res = await call(body({ bookedForId: "ghost" }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("bookedForId");
  });

  it("inactive beneficiary → 400", async () => {
    users.u2.active = false;
    const res = await call(body({ bookedForId: "u2" }));
    expect(res.status).toBe(400);
  });

  it("booking for yourself stores no beneficiary", async () => {
    await call(body({ bookedForId: "u1" }));
    expect(created().bookedForId).toBeNull();
  });
});
