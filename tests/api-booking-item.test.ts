import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  booking: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const session = vi.hoisted(() => ({ value: { user: { id: "booker" } } as any }));
const approval = vi.hoisted(() => ({ onBookingApproved: vi.fn(async () => {}), bookingRecipients: vi.fn(() => ["x@utcc.ac.th"]) }));
const email = vi.hoisted(() => ({ sendBookingNotification: vi.fn(async () => {}) }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/booking-approval", () => approval);
vi.mock("@/lib/email", () => email);
vi.mock("@/lib/room-calendar", () => ({ deleteRoomEvent: vi.fn(), isRoomCalendarConfigured: () => false }));

import { DELETE, GET, PUT } from "@/app/api/bookings/[id]/route";

type U = { id: string; role?: string; isPresidentApprover?: boolean };
const people: Record<string, U> = {
  booker: { id: "booker" },
  ben: { id: "ben" },
  admin1: { id: "admin1", role: "ROOM_ADMIN" },
  sys: { id: "sys", role: "SYSTEM_ADMIN" },
  pres: { id: "pres", role: "ROOM_ADMIN", isPresidentApprover: true },
};
const as = (id: string) => (session.value = { user: { id } });
const ctx = { params: Promise.resolve({ id: "b1" }) };

const booking = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  userId: "booker",
  bookedForId: "ben",
  status: "PENDING",
  title: "ประชุม",
  startTime: new Date(Date.now() + 86400_000),
  endTime: new Date(Date.now() + 90000_000),
  graphEventId: null,
  room: { name: "ห้อง A", roomAdminId: "admin1", requiresPresidentApproval: false, calendarEmail: null },
  user: { id: "booker", name: "B", email: "booker@utcc.ac.th" },
  bookedFor: null,
  ...over,
});
const put = (b: unknown) => PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(b) }) as any, ctx);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
    const p = people[where.id];
    return p ? { role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false, ...p } : null;
  });
  prisma.booking.findUnique.mockResolvedValue(booking());
  prisma.booking.updateMany.mockResolvedValue({ count: 1 });
});

describe("GET/DELETE /api/bookings/[id]", () => {
  it("beneficiary can view", async () => {
    as("ben");
    expect((await GET({} as any, ctx)).status).toBe(200);
  });
  it("stranger gets 404", async () => {
    as("admin1");
    prisma.booking.findUnique.mockResolvedValue(booking({ room: { roomAdminId: "other", requiresPresidentApproval: false } }));
    expect((await GET({} as any, ctx)).status).toBe(404);
  });
  it("view works when the beneficiary account is gone", async () => {
    as("booker");
    prisma.booking.findUnique.mockResolvedValue(booking({ bookedForId: null, bookedFor: null }));
    expect((await GET({} as any, ctx)).status).toBe(200);
  });
  it("beneficiary can cancel", async () => {
    as("ben");
    expect((await DELETE({} as any, ctx)).status).toBe(200);
    expect(prisma.booking.updateMany.mock.calls[0][0].data).toEqual({ status: "CANCELLED" });
  });
  it("room admin cannot cancel someone's booking", async () => {
    as("admin1");
    expect((await DELETE({} as any, ctx)).status).toBe(403);
  });
});

describe("PUT /api/bookings/[id] (decide)", () => {
  it("SYSTEM_ADMIN cannot decide a president room", async () => {
    as("sys");
    prisma.booking.findUnique.mockResolvedValue(booking({ room: { name: "ไทรทอง", roomAdminId: "admin1", requiresPresidentApproval: true } }));
    expect((await put({ status: "APPROVED" })).status).toBe(403);
  });
  it("president approver approves with a note and approvedById", async () => {
    as("pres");
    prisma.booking.findUnique.mockResolvedValue(booking({ room: { name: "ไทรทอง", roomAdminId: "admin1", requiresPresidentApproval: true } }));
    expect((await put({ status: "APPROVED", decisionNote: "แทนอธิการฯ" })).status).toBe(200);
    expect(prisma.booking.updateMany.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", approvedById: "pres", decisionNote: "แทนอธิการฯ" });
    expect(approval.onBookingApproved).toHaveBeenCalledWith("b1");
  });
  it("approver may approve their own request", async () => {
    as("admin1");
    prisma.booking.findUnique.mockResolvedValue(booking({ userId: "admin1", bookedForId: null }));
    expect((await put({ status: "APPROVED" })).status).toBe(200);
  });
  it("concurrent decision → 409", async () => {
    as("admin1");
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    expect((await put({ status: "APPROVED" })).status).toBe(409);
  });
  it("note over 500 characters → 400", async () => {
    as("admin1");
    expect((await put({ status: "APPROVED", decisionNote: "x".repeat(501) })).status).toBe(400);
  });
});
