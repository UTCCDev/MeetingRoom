import { describe, expect, it } from "vitest";
import {
  buildServicePayload,
  emptyServiceForm,
  isServiceFormFilled,
  validateFiles,
  validateServiceForm,
} from "@/lib/service-form";

const now = new Date("2026-11-11T05:00:00Z");
const far = new Date("2026-11-20T05:00:00Z");
const near = new Date("2026-11-12T05:00:00Z");

describe("service form helpers", () => {
  it("detects filled forms", () => {
    const v = emptyServiceForm();
    expect(isServiceFormFilled(v)).toBe(false);
    expect(isServiceFormFilled({ ...v, phone: "081", note: "x" })).toBe(false);
    expect(isServiceFormFilled({ ...v, selected: { a: 1 } })).toBe(true);
    expect(isServiceFormFilled({ ...v, others: [{ key: 1, text: " ", qty: 1 }] })).toBe(false);
    expect(isServiceFormFilled({ ...v, others: [{ key: 1, text: "ไมค์", qty: 1 }] })).toBe(true);
  });

  it("requires items, phone and lead time", () => {
    const e = validateServiceForm(emptyServiceForm(), { standalone: false, start: near, now });
    expect(e.items).toBeTruthy();
    expect(e.phone).toBeTruthy();
    expect(e.lead).toBe("ต้องขอล่วงหน้าอย่างน้อย 3 วัน");
    const ok = validateServiceForm(
      { ...emptyServiceForm(), selected: { a: 2 }, phone: "081" },
      { standalone: false, start: far, now },
    );
    expect(ok).toEqual({});
  });

  it("skips lead time for on-behalf and checks standalone fields", () => {
    const v = { ...emptyServiceForm(), selected: { a: 1 }, phone: "1" };
    const e = validateServiceForm(v, { standalone: true, start: near, now, skipLead: true });
    expect(e.lead).toBeUndefined();
    expect(e.location && e.date && e.time).toBeTruthy();
  });

  it("validates files", () => {
    const f = (name: string, size = 10, type = "image/png") => ({ name, size, type });
    expect(validateFiles([f("a.png")])).toBeUndefined();
    expect(validateFiles([f("a.exe", 10, "application/x")])).toMatch(/ไม่รองรับ/);
    expect(validateFiles([f("a.pdf", 6 * 1024 * 1024, "application/pdf")])).toMatch(/5 MB/);
    expect(validateFiles(Array.from({ length: 6 }, (_, i) => f(`${i}.png`)))).toMatch(/5 ไฟล์/);
  });

  it("builds payloads", () => {
    const v = {
      ...emptyServiceForm(),
      selected: { c1: 2 },
      others: [{ key: 1, text: " ขาตั้ง ", qty: 3 }, { key: 2, text: "", qty: 1 }],
      phone: " 081 ",
      location: "อาคาร A",
    };
    const p = buildServicePayload("AV", v, { bookingId: "b1" });
    expect(p.items).toEqual([{ catalogItemId: "c1", qty: 2 }, { otherText: "ขาตั้ง", qty: 3 }]);
    expect(p.contactPhone).toBe("081");
    expect("location" in p).toBe(false);
    const s = buildServicePayload("AV", v, { startISO: "s", endISO: "e" });
    expect(s).toMatchObject({ location: "อาคาร A", startTime: "s", endTime: "e" });
  });
});
