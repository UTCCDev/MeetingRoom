import { describe, expect, it } from "vitest";
import { defaultRequiresPresidentApproval } from "@/lib/room-code";

describe("defaultRequiresPresidentApproval", () => {
  it("ห้องไทรทอง by name", () => expect(defaultRequiresPresidentApproval({ name: "ห้องไทรทอง", code: "E030401" })).toBe(true));
  it("building 24 floor 08 by code", () => expect(defaultRequiresPresidentApproval({ name: "x", code: "M240801" })).toBe(true));
  it("other floor of building 24", () => expect(defaultRequiresPresidentApproval({ name: "x", code: "M240901" })).toBe(false));
  it("floor 08 of another building", () => expect(defaultRequiresPresidentApproval({ name: "x", code: "M230801" })).toBe(false));
  it("no code", () => expect(defaultRequiresPresidentApproval({ name: "x", code: null })).toBe(false));
});
