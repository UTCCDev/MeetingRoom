import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  department: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
}));
const session = vi.hoisted(() => ({ value: { user: { id: "sys", role: "SYSTEM_ADMIN" } } as any }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { PUT } from "@/app/api/admin/users/route";
import { DELETE as DELETE_DEPT, POST as POST_DEPT } from "@/app/api/admin/departments/route";

const req = (b: unknown) => new Request("http://x", { method: "PUT", body: JSON.stringify(b) }) as any;
const target = (over = {}) => ({ id: "t", role: "ROOM_ADMIN", email: "t@utcc.ac.th", isPresidentApprover: false, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(target());
  prisma.user.update.mockImplementation(async ({ data }: any) => ({ id: "t", ...data }));
});

const saved = () => prisma.user.update.mock.calls[0][0].data;

describe("PUT /api/admin/users — approval flags", () => {
  it("USER cannot get the president-approver flag", async () => {
    prisma.user.findUnique.mockResolvedValue(target({ role: "USER" }));
    const res = await PUT(req({ userId: "t", isPresidentApprover: true }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("demoting to USER clears the president-approver flag", async () => {
    prisma.user.findUnique.mockResolvedValue(target({ isPresidentApprover: true }));
    await PUT(req({ userId: "t", newRole: "USER" }));
    expect(saved()).toMatchObject({ role: "USER", isPresidentApprover: false });
  });

  it("ROOM_ADMIN gets the flag", async () => {
    await PUT(req({ userId: "t", isPresidentApprover: true }));
    expect(saved().isPresidentApprover).toBe(true);
  });

  it("autoApproveBooking is allowed on a USER", async () => {
    prisma.user.findUnique.mockResolvedValue(target({ role: "USER" }));
    await PUT(req({ userId: "t", autoApproveBooking: true }));
    expect(saved().autoApproveBooking).toBe(true);
  });

  it("sets and clears the department", async () => {
    await PUT(req({ userId: "t", departmentId: "d1" }));
    expect(saved().departmentId).toBe("d1");
    prisma.user.update.mockClear();
    await PUT(req({ userId: "t", departmentId: null }));
    expect(saved().departmentId).toBeNull();
  });
});

describe("/api/admin/departments", () => {
  it("non-admin → 403", async () => {
    session.value = { user: { id: "u", role: "USER" } };
    expect((await POST_DEPT(req({ name: "บัญชี" }))).status).toBe(403);
    session.value = { user: { id: "sys", role: "SYSTEM_ADMIN" } };
  });

  it("deleting a department that has users → 409", async () => {
    prisma.department.findUnique.mockResolvedValue({ id: "d1", _count: { users: 2 } });
    const res = await DELETE_DEPT(req({ id: "d1" }));
    expect(res.status).toBe(409);
    expect(prisma.department.delete).not.toHaveBeenCalled();
  });
});
