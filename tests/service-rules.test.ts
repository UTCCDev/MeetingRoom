import { describe, expect, it } from "vitest";
import {
  canManage,
  canRequesterCancel,
  canTransitionService,
  canViewRequest,
  canWork,
  deptFromParam,
  deptParam,
  meetsLeadTime,
  membershipIn,
  queueWhere,
  type Membership,
} from "@/lib/service-rules";

const d = (s: string) => new Date(s);
const H = 3600_000;

describe("meetsLeadTime", () => {
  const now = d("2026-11-11T23:00:00+07:00");
  it("true when start is on or after now + 3 Bangkok days", () => {
    expect(meetsLeadTime(d("2026-11-14T00:30:00+07:00"), now)).toBe(true);
  });
  it("false when start is before that Bangkok day", () => {
    expect(meetsLeadTime(d("2026-11-13T23:30:00+07:00"), now)).toBe(false);
  });
});

describe("canTransitionService", () => {
  it("allows the listed transitions", () => {
    expect(canTransitionService("PENDING", "ACCEPTED")).toBe(true);
    expect(canTransitionService("PENDING", "REJECTED")).toBe(true);
    expect(canTransitionService("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionService("ACCEPTED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionService("ACCEPTED", "CANCELLED")).toBe(true);
    expect(canTransitionService("IN_PROGRESS", "DONE")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(canTransitionService("DONE", "PENDING")).toBe(false);
    expect(canTransitionService("REJECTED", "ACCEPTED")).toBe(false);
    expect(canTransitionService("IN_PROGRESS", "CANCELLED")).toBe(false);
  });
});

describe("canRequesterCancel", () => {
  const now = d("2026-11-11T10:00:00+07:00");
  const at = (h: number) => new Date(now.getTime() + h * H);
  it("PENDING 1 h before start is allowed", () => {
    expect(canRequesterCancel({ status: "PENDING", startTime: at(1) }, now)).toBe(true);
  });
  it("ACCEPTED 25 h before start is allowed", () => {
    expect(canRequesterCancel({ status: "ACCEPTED", startTime: at(25) }, now)).toBe(true);
  });
  it("ACCEPTED 23 h before start is not", () => {
    expect(canRequesterCancel({ status: "ACCEPTED", startTime: at(23) }, now)).toBe(false);
  });
  it("IN_PROGRESS is not", () => {
    expect(canRequesterCancel({ status: "IN_PROGRESS", startTime: at(48) }, now)).toBe(false);
  });
  it("after start is not", () => {
    expect(canRequesterCancel({ status: "PENDING", startTime: at(-1) }, now)).toBe(false);
  });
});

describe("canViewRequest", () => {
  const admin: Membership[] = [{ department: "AV", role: "ADMIN" }];
  const staff: Membership[] = [{ department: "AV", role: "STAFF" }];
  const hk: Membership[] = [{ department: "HOUSEKEEPING", role: "ADMIN" }];
  const base = { requesterId: "r", department: "AV" as const, visibleAt: new Date(), assigneeId: null };
  it("requester sees it even when not visible", () => {
    expect(canViewRequest("r", [], { ...base, visibleAt: null })).toBe(true);
  });
  it("dept ADMIN does not see it when visibleAt is null", () => {
    expect(canViewRequest("a", admin, { ...base, visibleAt: null })).toBe(false);
  });
  it("dept ADMIN sees it when visible", () => {
    expect(canViewRequest("a", admin, base)).toBe(true);
  });
  it("STAFF who is not the assignee does not", () => {
    expect(canViewRequest("s", staff, { ...base, assigneeId: "other" })).toBe(false);
  });
  it("STAFF assignee does", () => {
    expect(canViewRequest("s", staff, { ...base, assigneeId: "s" })).toBe(true);
  });
  it("ADMIN of another department does not", () => {
    expect(canViewRequest("h", hk, base)).toBe(false);
  });
});

describe("queueWhere", () => {
  it("STAFF is limited to their assignments", () => {
    expect(queueWhere("u", { department: "AV", role: "STAFF" })).toEqual({
      department: "AV",
      visibleAt: { not: null },
      assigneeId: "u",
    });
  });
  it("ADMIN sees the whole visible department queue", () => {
    const w = queueWhere("u", { department: "AV", role: "ADMIN" });
    expect(w).toEqual({ department: "AV", visibleAt: { not: null } });
    expect(w).not.toHaveProperty("assigneeId");
  });
});

describe("helpers", () => {
  const ms: Membership[] = [{ department: "AV", role: "STAFF" }];
  it("membershipIn / canManage / canWork", () => {
    expect(membershipIn(ms, "AV")).toEqual(ms[0]);
    expect(membershipIn(ms, "HOUSEKEEPING")).toBeNull();
    expect(canManage(ms, "AV")).toBe(false);
    expect(canManage([{ department: "AV", role: "ADMIN" }], "AV")).toBe(true);
    expect(canWork("u", ms, { department: "AV", assigneeId: "u" })).toBe(true);
    expect(canWork("u", ms, { department: "AV", assigneeId: "x" })).toBe(false);
    expect(canWork("u", [{ department: "AV", role: "ADMIN" }], { department: "AV", assigneeId: null })).toBe(true);
  });
});

describe("dept URL param", () => {
  it("deptFromParam maps lowercase segments and rejects the rest", () => {
    expect(deptFromParam("av")).toBe("AV");
    expect(deptFromParam("housekeeping")).toBe("HOUSEKEEPING");
    for (const bad of ["AV", "Housekeeping", "", "x", "HOUSEKEEPING"]) expect(deptFromParam(bad)).toBeNull();
  });
  it("deptParam is the inverse", () => {
    expect(deptParam("AV")).toBe("av");
    expect(deptParam("HOUSEKEEPING")).toBe("housekeeping");
    for (const d of ["AV", "HOUSEKEEPING"] as const) expect(deptFromParam(deptParam(d))).toBe(d);
  });
});
