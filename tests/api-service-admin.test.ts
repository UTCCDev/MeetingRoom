import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  serviceCatalogItem: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  serviceMember: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const actor = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/service-actor", () => ({ loadServiceActor: vi.fn(async () => actor.value) }));

import { GET as CAT_GET, POST as CAT_POST } from "@/app/api/service-catalog/manage/route";
import { GET as MEM_GET, POST as MEM_POST } from "@/app/api/admin/service-members/route";
import { POST as MEM_DEL } from "@/app/api/admin/service-members/[id]/delete/route";

const NO_PERM = "คุณไม่มีสิทธิ์ดำเนินการนี้";
const post = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) }) as any;
const get = (q = "") => new Request("http://x/api" + q) as any;
const as = (role: string, memberships: any[] = []) => (actor.value = { id: "u1", role, memberships });
const item = { department: "AV", name: "ไมค์", returnable: true, active: true, sortOrder: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  as("USER", [{ department: "AV", role: "ADMIN" }]);
});

describe("/api/service-catalog/manage", () => {
  it("401 when signed out", async () => {
    actor.value = null;
    expect((await CAT_GET(get("?dept=AV"))).status).toBe(401);
  });
  it("400 without valid dept", async () => {
    expect((await CAT_GET(get())).status).toBe(400);
    expect((await CAT_GET(get("?dept=X"))).status).toBe(400);
  });
  it("non-admin gets 403", async () => {
    as("USER", [{ department: "AV", role: "STAFF" }]);
    const res = await CAT_GET(get("?dept=AV"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(NO_PERM);
  });
  it("HK admin managing AV gets 403", async () => {
    as("USER", [{ department: "HOUSEKEEPING", role: "ADMIN" }]);
    expect((await CAT_GET(get("?dept=AV"))).status).toBe(403);
    expect((await CAT_POST(post(item))).status).toBe(403);
  });
  it("admin lists all items incl. inactive", async () => {
    prisma.serviceCatalogItem.findMany.mockResolvedValue([]);
    expect((await CAT_GET(get("?dept=AV"))).status).toBe(200);
    expect(prisma.serviceCatalogItem.findMany.mock.calls[0][0].where).toEqual({ department: "AV" });
  });
  it("creates an item with trimmed name", async () => {
    prisma.serviceCatalogItem.create.mockResolvedValue({ id: "i" });
    const res = await CAT_POST(post({ ...item, name: "  ไมค์  " }));
    expect(res.status).toBe(200);
    expect(prisma.serviceCatalogItem.create.mock.calls[0][0].data.name).toBe("ไมค์");
  });
  it("rejects empty/long name", async () => {
    expect((await CAT_POST(post({ ...item, name: "   " }))).status).toBe(400);
    expect((await CAT_POST(post({ ...item, name: "x".repeat(101) }))).status).toBe(400);
  });
  it("duplicate name -> 409", async () => {
    prisma.serviceCatalogItem.create.mockRejectedValue({ code: "P2002" });
    const res = await CAT_POST(post(item));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("มีรายการนี้อยู่แล้ว");
  });
  it("update of item in another department -> 404", async () => {
    prisma.serviceCatalogItem.findUnique.mockResolvedValue({ id: "i", department: "HOUSEKEEPING" });
    expect((await CAT_POST(post({ ...item, id: "i" }))).status).toBe(404);
    expect(prisma.serviceCatalogItem.update).not.toHaveBeenCalled();
  });
  it("update can deactivate", async () => {
    prisma.serviceCatalogItem.findUnique.mockResolvedValue({ id: "i", department: "AV" });
    prisma.serviceCatalogItem.update.mockResolvedValue({ id: "i" });
    expect((await CAT_POST(post({ ...item, id: "i", active: false }))).status).toBe(200);
    expect(prisma.serviceCatalogItem.update.mock.calls[0][0].data.active).toBe(false);
  });
});

describe("/api/admin/service-members", () => {
  it("401 when signed out", async () => {
    actor.value = null;
    expect((await MEM_GET()).status).toBe(401);
  });
  it("ROOM_ADMIN gets 403", async () => {
    as("ROOM_ADMIN");
    expect((await MEM_GET()).status).toBe(403);
    expect((await MEM_POST(post({ userId: "a", department: "AV", role: "ADMIN" }))).status).toBe(403);
    expect((await MEM_DEL(post({}), { params: Promise.resolve({ id: "m" }) } as any)).status).toBe(403);
  });
  it("lists members with safe user fields, ordered", async () => {
    as("SYSTEM_ADMIN");
    prisma.serviceMember.findMany.mockResolvedValue([]);
    expect((await MEM_GET()).status).toBe(200);
    const arg = prisma.serviceMember.findMany.mock.calls[0][0];
    expect(arg.include.user.select).toEqual({ id: true, name: true, email: true });
    expect(arg.orderBy).toEqual([{ department: "asc" }, { user: { name: "asc" } }]);
  });
  it("SYSTEM_ADMIN upsert changes role", async () => {
    as("SYSTEM_ADMIN");
    prisma.user.findUnique.mockResolvedValue({ id: "a", active: true });
    prisma.serviceMember.upsert.mockResolvedValue({ id: "m" });
    const res = await MEM_POST(post({ userId: "a", department: "AV", role: "ADMIN" }));
    expect(res.status).toBe(200);
    const arg = prisma.serviceMember.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId_department: { userId: "a", department: "AV" } });
    expect(arg.update).toEqual({ role: "ADMIN" });
  });
  it("unknown or inactive user -> 400", async () => {
    as("SYSTEM_ADMIN");
    prisma.user.findUnique.mockResolvedValue({ id: "a", active: false });
    const res = await MEM_POST(post({ userId: "a", department: "AV", role: "STAFF" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ไม่พบผู้ใช้ หรือบัญชีถูกปิดใช้งาน");
    prisma.user.findUnique.mockResolvedValue(null);
    expect((await MEM_POST(post({ userId: "a", department: "AV", role: "STAFF" }))).status).toBe(400);
  });
  it("delete removes, 404 when missing", async () => {
    as("SYSTEM_ADMIN");
    prisma.serviceMember.findUnique.mockResolvedValue(null);
    expect((await MEM_DEL(post({}), { params: Promise.resolve({ id: "m" }) } as any)).status).toBe(404);
    prisma.serviceMember.findUnique.mockResolvedValue({ id: "m" });
    expect((await MEM_DEL(post({}), { params: Promise.resolve({ id: "m" }) } as any)).status).toBe(200);
    expect(prisma.serviceMember.delete).toHaveBeenCalledWith({ where: { id: "m" } });
  });
});

