import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  booking: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const calendar = vi.hoisted(() => ({
  createRoomEvent: vi.fn(),
  isRoomCalendarConfigured: vi.fn(() => true),
}));
const email = vi.hoisted(() => ({ sendBookingNotification: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/room-calendar", () => calendar);
vi.mock("@/lib/email", () => email);

import { onBookingApproved } from "@/lib/booking-approval";
import { loadActor } from "@/lib/actor";

const booking = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  title: "ประชุม",
  startTime: new Date("2026-12-01T02:00:00Z"),
  room: { name: "ห้อง A", calendarEmail: "room@utcc.ac.th" },
  user: { name: "A", email: "a@utcc.ac.th" },
  bookedFor: { name: "B", email: "b@utcc.ac.th" },
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("onBookingApproved", () => {
  it("emails booker and beneficiary", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    await onBookingApproved("b1");
    expect(email.sendBookingNotification.mock.calls[0][0]).toEqual(["a@utcc.ac.th", "b@utcc.ac.th"]);
  });

  it("emails only the booker when there is no beneficiary", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking({ bookedFor: null }));
    await onBookingApproved("b1");
    expect(email.sendBookingNotification.mock.calls[0][0]).toEqual(["a@utcc.ac.th"]);
  });

  it("saves the Graph event id", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    calendar.createRoomEvent.mockResolvedValue("evt1");
    await onBookingApproved("b1");
    expect(prisma.booking.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { graphEventId: "evt1" } });
  });

  it("still emails when the calendar sync fails", async () => {
    prisma.booking.findUnique.mockResolvedValue(booking());
    calendar.createRoomEvent.mockRejectedValue(new Error("graph down"));
    await expect(onBookingApproved("b1")).resolves.toBeUndefined();
    expect(email.sendBookingNotification).toHaveBeenCalled();
  });
});

describe("loadActor", () => {
  it("returns null for an inactive user", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", active: false, isPresidentApprover: false, autoApproveBooking: false });
    expect(await loadActor({ user: { id: "u1" } })).toBeNull();
  });

  it("returns the DB flags, not the session", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "ROOM_ADMIN", active: true, isPresidentApprover: true, autoApproveBooking: false });
    expect(await loadActor({ user: { id: "u1", role: "USER" } } as any)).toEqual({
      id: "u1",
      role: "ROOM_ADMIN",
      isPresidentApprover: true,
      autoApproveBooking: false,
    });
  });

  it("returns null without a session", async () => {
    expect(await loadActor(null)).toBeNull();
  });
});
