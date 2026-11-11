import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ serviceMember: { findMany: vi.fn() } }));
const actor = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/service-actor", () => ({ loadServiceActor: vi.fn(async () => actor.value) }));

import { GET } from "@/app/api/service-members/route";

const NO_PERM = "คุณไม่มีสิทธิ์ดำเนินการนี้";
const get = (q = "") => new Request("http://x/api/service-members" + q) as any;
const as = (memberships: any[], role = "USER") => (actor.value = { id: "u1", role, memberships });

beforeEach(() => {
  vi.resetAllMocks();
  as([{ department: "AV", role: "ADMIN" }]);
});

describe("GET /api/service-members", () => {
  it("401 when signed out", async () => {
    actor.value = null;
    expect((await GET(get("?dept=AV"))).status).toBe(401);
  });
  it("400 on missing or unknown dept", async () => {
    expect((await GET(get())).status).toBe(400);
    expect((await GET(get("?dept=X"))).status).toBe(400);
  });
  it("403 for non-member and for members of the other department", async () => {
    as([]);
    const res = await GET(get("?dept=AV"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(NO_PERM);
    as([{ department: "HOUSEKEEPING", role: "ADMIN" }]);
    expect((await GET(get("?dept=AV"))).status).toBe(403);
  });
  it("SYSTEM_ADMIN without membership is still refused", async () => {
    as([], "SYSTEM_ADMIN");
    expect((await GET(get("?dept=AV"))).status).toBe(403);
  });
  it.each(["ADMIN", "STAFF"])("%s of the dept gets the member list", async (role) => {
    as([{ department: "AV", role }]);
    const rows = [{ id: "m1", userId: "u2", role: "STAFF", user: { id: "u2", name: "ก", email: "a@x" } }];
    prisma.serviceMember.findMany.mockResolvedValue(rows);
    const res = await GET(get("?dept=AV"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
    const arg = prisma.serviceMember.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ department: "AV" });
    expect(arg.include.user.select).toEqual({ id: true, name: true, email: true });
  });
  it("500 on db error", async () => {
    prisma.serviceMember.findMany.mockRejectedValue(new Error("x"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET(get("?dept=AV"))).status).toBe(500);
  });
});
