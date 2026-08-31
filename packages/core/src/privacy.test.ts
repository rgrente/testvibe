import { describe, expect, it } from "vitest";
import {
  effectiveVisibility,
  inferLivingStatus,
  isVisibleToAudience,
  privacyThresholdYears,
} from "./privacy.js";
import type { Person } from "./types.js";

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 1,
  firstName: "Ada",
  lastName: "Lovelace",
  birthName: null,
  birthDate: null,
  deathDate: null,
  gender: null,
  livingStatus: null,
  visibility: null,
  ...overrides,
});

describe("living-person privacy policy", () => {
  it("fails closed for unknown, incomplete, recent, future, and invalid dates", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");
    for (const birthDate of [null, "2000", "1906-09", "2030-01-01", "invalid"]) {
      expect(inferLivingStatus(person({ birthDate }), { now, thresholdYears: 120 })).toBe("living");
      expect(effectiveVisibility(person({ birthDate }), { now, thresholdYears: 120 })).toBe("family");
    }
  });

  it("honours explicit status and visibility while deceased defaults public", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");
    expect(inferLivingStatus(person({ livingStatus: "deceased" }), { now })).toBe("deceased");
    expect(effectiveVisibility(person({ livingStatus: "deceased" }), { now })).toBe("public");
    expect(effectiveVisibility(person({ deathDate: "2026" }), { now })).toBe("public");
    expect(effectiveVisibility(person({ birthDate: "1800-01-01" }), { now })).toBe("public");
    expect(effectiveVisibility(person({ deathDate: "2026", visibility: "private" }), { now })).toBe("private");
  });

  it("enforces public < family < private and the strictest linked visibility", () => {
    expect(isVisibleToAudience("public", "public")).toBe(true);
    expect(isVisibleToAudience("family", "public")).toBe(false);
    expect(isVisibleToAudience("family", "family")).toBe(true);
    expect(isVisibleToAudience("private", "family")).toBe(false);
    expect(isVisibleToAudience("private", "private")).toBe(true);
    expect(effectiveVisibility(["public", "private", "family"])).toBe("private");
    expect(effectiveVisibility([])).toBe("private");
  });

  it("accepts only a positive integer configured threshold", () => {
    expect(privacyThresholdYears("100")).toBe(100);
    for (const value of [undefined, "", "0", "-1", "12.5", "invalid"]) {
      expect(privacyThresholdYears(value)).toBe(120);
    }
  });
});
