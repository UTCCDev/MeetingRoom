import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({ readFile: vi.fn(), writeFile: vi.fn(async () => {}), mkdir: vi.fn(async () => {}) }));
const prisma = vi.hoisted(() => ({
  serviceAttachment: { findFirst: vi.fn() },
  serviceRequest: { findUnique: vi.fn() },
  serviceMember: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const session = vi.hoisted(() => ({ value: { user: { id: "req1" } } as any }));

vi.mock("fs/promises", () => ({ ...fs, default: fs }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.value) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { fileType } from "@/lib/uploads";
import { saveServiceFiles, UploadError } from "@/lib/service-attachments";
import { GET } from "@/app/api/service-requests/[id]/attachments/[name]/route";

const pdfBytes = () => new TextEncoder().encode("%PDF-1.7\n....");
const mkFile = (bytes: Uint8Array, name = "a.pdf") => new File([bytes as BlobPart], name);

describe("fileType", () => {
  it("detects pdf", () => expect(fileType(pdfBytes())).toEqual({ ext: "pdf", mime: "application/pdf" }));
  it("detects png", () =>
    expect(fileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe("png"));
  it("rejects text", () => expect(fileType(new TextEncoder().encode("hello world!!"))).toBeNull());
});

describe("saveServiceFiles", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects more than 5 files", async () => {
    const files = Array.from({ length: 6 }, () => mkFile(pdfBytes()));
    await expect(saveServiceFiles(files)).rejects.toThrow("แนบไฟล์ได้ไม่เกิน 5 ไฟล์");
  });
  it("rejects files over 5 MB", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    big.set(pdfBytes());
    await expect(saveServiceFiles([mkFile(big)])).rejects.toThrow("ไฟล์ใหญ่เกิน 5 MB");
  });
  it("rejects unknown type", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);
    const err = await saveServiceFiles([mkFile(exe, "a.exe")]).catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.message).toBe("รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WebP");
  });
  it("saves a pdf under a uuid name", async () => {
    const out = await saveServiceFiles([mkFile(pdfBytes(), "ใบขอ.pdf")]);
    expect(out[0]).toMatchObject({ originalName: "ใบขอ.pdf", mime: "application/pdf" });
    expect(out[0].fileName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });
});

describe("GET attachment", () => {
  const name = "11111111-1111-1111-1111-111111111111.pdf";
  const call = (n = name, id = "r1") =>
    GET({} as any, { params: Promise.resolve({ id, name: n }) });
  beforeEach(() => {
    vi.clearAllMocks();
    session.value = { user: { id: "req1" } };
    prisma.user.findUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id, role: "USER", active: true, isPresidentApprover: false, autoApproveBooking: false,
    }));
    prisma.serviceMember.findMany.mockResolvedValue([]);
    prisma.serviceAttachment.findFirst.mockResolvedValue({
      fileName: name, mime: "application/pdf",
      request: { requesterId: "req1", department: "AV", visibleAt: null, assigneeId: null },
    });
    fs.readFile.mockResolvedValue(Buffer.from(pdfBytes()));
  });
  it("401 when signed out", async () => {
    session.value = null;
    expect((await call()).status).toBe(401);
  });
  it("404 for stranger", async () => {
    session.value = { user: { id: "stranger" } };
    expect((await call()).status).toBe(404);
  });
  it("404 for bad name", async () => {
    expect((await call("../x.pdf")).status).toBe(404);
  });
  it("404 when attachment is not on the request", async () => {
    prisma.serviceAttachment.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
  it("requester gets the pdf inline", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe("inline");
  });
});
