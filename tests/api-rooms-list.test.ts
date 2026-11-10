import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ room: { findMany: vi.fn(async () => []) } }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/rooms/route";

const call = (qs = "") => GET({ nextUrl: new URL(`http://x/api/rooms${qs}`) } as any);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/rooms", () => {
  it("room search lists smallest capacity first, then by code", async () => {
    await call();
    expect((prisma.room.findMany.mock.calls[0] as any[])[0].orderBy).toEqual([{ capacity: "asc" }, { code: "asc" }]);
  });
});
