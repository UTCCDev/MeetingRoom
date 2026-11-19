import { describe, expect, it } from "vitest";
import {
  approvalRoute,
  canCancel,
  canDecide,
  canView,
  normalizeBeneficiary,
  presidentFlagFor,
  type Actor,
  type RoomRule,
} from "@/lib/validation";

const actor = (over: Partial<Actor> = {}): Actor => ({
  id: "u1",
  role: "USER",
  isPresidentApprover: false,
  autoApproveBooking: false,
  ...over,
});
const normal: RoomRule = { roomAdminId: "admin1", requiresPresidentApproval: false };
const special: RoomRule = { roomAdminId: "admin1", requiresPresidentApproval: true };
const both = { autoApproveBooking: true, isPresidentApprover: true };

describe("approvalRoute — normal room", () => {
  it("plain USER waits for the room admin", () => {
    expect(approvalRoute(actor(), null, normal)).toBe("ROOM_ADMIN");
  });
  it("SYSTEM_ADMIN without the flag waits too", () => {
    expect(approvalRoute(actor({ role: "SYSTEM_ADMIN" }), null, normal)).toBe("ROOM_ADMIN");
  });
  it("booker with autoApproveBooking is AUTO", () => {
    expect(approvalRoute(actor({ autoApproveBooking: true }), null, normal)).toBe("AUTO");
  });
  it("beneficiary with autoApproveBooking is AUTO", () => {
    expect(approvalRoute(actor(), actor({ id: "u2", autoApproveBooking: true }), normal)).toBe("AUTO");
  });
  it("room with autoApprove is AUTO for anyone", () => {
    expect(approvalRoute(actor(), null, { ...normal, autoApprove: true })).toBe("AUTO");
  });
  it("president room ignores autoApprove", () => {
    expect(approvalRoute(actor(), null, { ...special, autoApprove: true })).toBe("PRESIDENT");
  });
});

describe("approvalRoute — president room", () => {
  it("booker with auto only waits for the president", () => {
    expect(approvalRoute(actor({ autoApproveBooking: true }), null, special)).toBe("PRESIDENT");
  });
  it("booker with president-approver only waits", () => {
    expect(approvalRoute(actor({ role: "ROOM_ADMIN", isPresidentApprover: true }), null, special)).toBe("PRESIDENT");
  });
  it("booker with both flags is AUTO", () => {
    expect(approvalRoute(actor({ role: "ROOM_ADMIN", ...both }), null, special)).toBe("AUTO");
  });
  it("beneficiary flags never count in a president room", () => {
    expect(approvalRoute(actor(), actor({ id: "u2", role: "ROOM_ADMIN", ...both }), special)).toBe("PRESIDENT");
  });
  it("SYSTEM_ADMIN with auto only waits", () => {
    expect(approvalRoute(actor({ role: "SYSTEM_ADMIN", autoApproveBooking: true }), null, special)).toBe("PRESIDENT");
  });
});

describe("canDecide", () => {
  it("SYSTEM_ADMIN decides any normal room", () => {
    expect(canDecide(actor({ role: "SYSTEM_ADMIN" }), normal)).toBe(true);
  });
  it("ROOM_ADMIN decides own room only", () => {
    expect(canDecide(actor({ id: "admin1", role: "ROOM_ADMIN" }), normal)).toBe(true);
    expect(canDecide(actor({ id: "other", role: "ROOM_ADMIN" }), normal)).toBe(false);
  });
  it("USER decides nothing", () => {
    expect(canDecide(actor({ id: "admin1" }), normal)).toBe(false);
  });
  it("SYSTEM_ADMIN cannot decide a president room", () => {
    expect(canDecide(actor({ role: "SYSTEM_ADMIN" }), special)).toBe(false);
  });
  it("president approver decides a president room", () => {
    expect(canDecide(actor({ role: "ROOM_ADMIN", isPresidentApprover: true }), special)).toBe(true);
  });
  it("own room admin cannot decide own president room without the flag", () => {
    expect(canDecide(actor({ id: "admin1", role: "ROOM_ADMIN" }), special)).toBe(false);
  });
});

describe("canView / canCancel", () => {
  const booking = { userId: "booker", bookedForId: "ben", room: normal };
  it("booker, beneficiary and deciding admin can view", () => {
    expect(canView(actor({ id: "booker" }), booking)).toBe(true);
    expect(canView(actor({ id: "ben" }), booking)).toBe(true);
    expect(canView(actor({ id: "admin1", role: "ROOM_ADMIN" }), booking)).toBe(true);
  });
  it("stranger cannot view", () => {
    expect(canView(actor({ id: "x" }), booking)).toBe(false);
  });
  it("booker and beneficiary can cancel, admin cannot", () => {
    expect(canCancel("booker", booking)).toBe(true);
    expect(canCancel("ben", booking)).toBe(true);
    expect(canCancel("admin1", booking)).toBe(false);
  });
});

describe("normalizeBeneficiary", () => {
  it("self becomes null", () => expect(normalizeBeneficiary("u1", "u1")).toBeNull());
  it("other stays", () => expect(normalizeBeneficiary("u1", "u2")).toBe("u2"));
  it("missing becomes null", () => expect(normalizeBeneficiary("u1", undefined)).toBeNull());
});

describe("presidentFlagFor", () => {
  it("USER can never hold it", () => expect(presidentFlagFor("USER", true, false)).toBe(false));
  it("keeps current when not requested", () => expect(presidentFlagFor("ROOM_ADMIN", undefined, true)).toBe(true));
  it("demotion to USER clears it", () => expect(presidentFlagFor("USER", undefined, true)).toBe(false));
});

import { decidableRoomWhere } from "@/lib/validation";

describe("decidableRoomWhere", () => {
  it("USER decides nothing", () => {
    expect(decidableRoomWhere(actor())).toBeNull();
  });
  it("SYSTEM_ADMIN: every normal room", () => {
    expect(decidableRoomWhere(actor({ role: "SYSTEM_ADMIN" }))).toEqual({ OR: [{ requiresPresidentApproval: false }] });
  });
  it("ROOM_ADMIN: own normal rooms", () => {
    expect(decidableRoomWhere(actor({ id: "a", role: "ROOM_ADMIN" }))).toEqual({
      OR: [{ requiresPresidentApproval: false, roomAdminId: "a" }],
    });
  });
  it("president approver adds president rooms", () => {
    expect(decidableRoomWhere(actor({ id: "a", role: "ROOM_ADMIN", isPresidentApprover: true }))).toEqual({
      OR: [{ requiresPresidentApproval: false, roomAdminId: "a" }, { requiresPresidentApproval: true }],
    });
  });
});
