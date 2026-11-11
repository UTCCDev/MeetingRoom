import { describe, expect, it } from "vitest";
import { countByStatus, filterRows, itemsText, needsReturn, type ServiceRow } from "@/lib/service-client";

const row = (o: Partial<ServiceRow>): ServiceRow =>
  ({
    id: "r",
    department: "AV",
    status: "PENDING",
    startTime: "2026-12-01T03:00:00.000Z",
    endTime: "2026-12-01T05:00:00.000Z",
    items: [],
    requester: { id: "u", name: "สมชาย ใจดี", email: "s@x" },
    booking: { id: "b", title: "ประชุม", room: { name: "ห้อง 101" } },
    location: null,
    ...o,
  }) as ServiceRow;

describe("service-client", () => {
  const rows = [
    row({ id: "1", status: "PENDING" }),
    row({ id: "2", status: "DONE", booking: null, location: "ลานกิจกรรม", requester: { id: "v", name: "มานี", email: "m@x" } }),
    row({ id: "3", status: "PENDING", startTime: "2026-12-05T03:00:00.000Z" }),
  ];
  it("counts per status", () => {
    expect(countByStatus(rows)).toMatchObject({ PENDING: 2, DONE: 1, ACCEPTED: 0 });
  });
  it("filters by status", () => {
    expect(filterRows(rows, { status: "DONE" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("searches requester, room and location, case/space-insensitive", () => {
    expect(filterRows(rows, { q: " สมชาย " }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterRows(rows, { q: "ห้อง 101" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterRows(rows, { q: "ลานกิจกรรม" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterRows(rows, { q: "m@x" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("filters by Bangkok date of use", () => {
    expect(filterRows(rows, { date: "2026-12-05" }).map((r) => r.id)).toEqual(["3"]);
    // 2026-12-01T20:00Z is already 2 Dec in Bangkok
    expect(filterRows([row({ startTime: "2026-12-01T20:00:00.000Z" })], { date: "2026-12-02" })).toHaveLength(1);
  });
  it("itemsText and needsReturn", () => {
    const items = [
      { id: "a", qty: 2, otherText: null, catalogItem: { name: "ไมค์", returnable: true } },
      { id: "b", qty: 1, otherText: "สายต่อ", catalogItem: null },
    ];
    expect(itemsText(items)).toBe("ไมค์ × 2, สายต่อ × 1");
    expect(needsReturn(items)).toBe(true);
    expect(needsReturn([items[1]])).toBe(false);
  });
});
