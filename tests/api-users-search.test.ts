import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ user: { findMany: vi.fn() } }));
const session = vi.hoisted(() => ({ value: { user: { id: "u1" } } as any }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/users/search/route";

const call = (q: string) => GET(new Request(`http://x/api/users/search?q=${encodeURIComponent(q)}`) as any);

beforeEach(() => {
  vi.clearAllMocks();
  session.value = { user: { id: "u1" } };
  prisma.user.findMany.mockResolvedValue([
    { id: "u2", name: "สมชาย", email: "s@utcc.ac.th", department: { name: "บัญชี" } },
  ]);
});

describe("GET /api/users/search", () => {
  it("401 when signed out", async () => {
    session.value = null;
    expect((await call("สม")).status).toBe(401);
  });

  it("returns [] for a query under 2 characters without hitting the DB", async () => {
    expect(await (await call("ส")).json()).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("searches active users, max 10, flattening the department name", async () => {
    const res = await call("สม");
    expect(await res.json()).toEqual([{ id: "u2", name: "สมชาย", email: "s@utcc.ac.th", department: "บัญชี" }]);
    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.take).toBe(10);
    expect(args.where.active).toBe(true);
  });
});
