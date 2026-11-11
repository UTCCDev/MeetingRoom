import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  booking: { findMany: vi.fn() },
  serviceMember: { findMany: vi.fn() },
}));
const svc = vi.hoisted(() => ({ serviceNotifications: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actor", () => ({ loadActor: vi.fn(async () => ({ id: "u1", role: "USER", memberships: [] })) }));
vi.mock("@/lib/service-notifications", () => svc);

import { GET } from "@/app/api/notifications/route";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.serviceMember.findMany.mockResolvedValue([]);
  prisma.booking.findMany.mockResolvedValue([
    {
      id: "b1", title: "ประชุม", status: "APPROVED", startTime: new Date(Date.now() + 3600_000),
      endTime: new Date(Date.now() + 7200_000), attendees: 3, updatedAt: new Date(), createdAt: new Date(),
      rejectionReason: null, room: { id: "r", name: "A", description: null, capacity: 5 },
    },
  ]);
});

describe("GET /api/notifications", () => {
  it("service notification failure still returns booking items with 200", async () => {
    svc.serviceNotifications.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).items.length).toBeGreaterThan(0);
  });
});
