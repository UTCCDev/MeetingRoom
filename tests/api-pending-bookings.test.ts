import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ booking: { findMany: vi.fn() }, user: { findUnique: vi.fn() } }));
const session = vi.hoisted(() => ({ value: { user: { id: "u1" } } as any }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/service-booking-sync", () => ({ onBookingApprovedServices: vi.fn(async () => {}), onBookingClosedServices: vi.fn(async () => {}) }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/admin/pending-bookings/route";

const me = (over: Record<string, unknown>) =>
  prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.booking.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/pending-bookings", () => {
  it("USER → 403", async () => {
    me({});
    expect((await GET({} as any)).status).toBe(403);
  });

  it("SYSTEM_ADMIN without the flag does not see president rooms", async () => {
    me({ role: "SYSTEM_ADMIN" });
    await GET({} as any);
    expect(prisma.booking.findMany.mock.calls[0][0].where).toEqual({
      status: "PENDING",
      room: { OR: [{ requiresPresidentApproval: false }] },
    });
  });

  it("president approver sees own rooms plus president rooms, with beneficiary included", async () => {
    me({ role: "ROOM_ADMIN", isPresidentApprover: true });
    await GET({} as any);
    const args = prisma.booking.findMany.mock.calls[0][0];
    expect(args.where.room).toEqual({
      OR: [{ requiresPresidentApproval: false, roomAdminId: "u1" }, { requiresPresidentApproval: true }],
    });
    expect(args.include.bookedFor).toBeTruthy();
  });
});
