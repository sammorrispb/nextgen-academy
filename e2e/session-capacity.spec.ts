import { test, expect } from "@playwright/test";
import { computeRegistrationIncrement } from "../src/lib/notion-sessions";

const base = { registeredCount: 0, courtCount: 1, maxCourts: 2, status: "Open" as const };

test.describe("computeRegistrationIncrement — expand at one seat left", () => {
  test("expands when the registration leaves exactly one seat (3rd of 4)", () => {
    const out = computeRegistrationIncrement({ ...base, registeredCount: 2 }, 1);
    expect(out).toEqual({
      newCount: 3,
      newCourtCount: 2,
      newCapacity: 8,
      newStatus: "Open",
    });
  });

  test("does NOT expand with two seats still open (2nd of 4)", () => {
    const out = computeRegistrationIncrement({ ...base, registeredCount: 1 }, 1);
    expect(out).toEqual({
      newCount: 2,
      newCourtCount: 1,
      newCapacity: 4,
      newStatus: "Open",
    });
  });

  test("no expansion when Max courts is unset (clamped to court count)", () => {
    const out = computeRegistrationIncrement(
      { ...base, registeredCount: 3, maxCourts: 1 },
      1,
    );
    expect(out).toEqual({
      newCount: 4,
      newCourtCount: 1,
      newCapacity: 4,
      newStatus: "Full",
    });
  });

  test("never exceeds maxCourts; Full only at ceiling capacity", () => {
    const at7 = computeRegistrationIncrement(
      { ...base, registeredCount: 6, courtCount: 2 },
      1,
    );
    expect(at7.newCourtCount).toBe(2);
    expect(at7.newStatus).toBe("Open"); // 7/8, one seat left at the ceiling

    const at8 = computeRegistrationIncrement(
      { ...base, registeredCount: 7, courtCount: 2 },
      1,
    );
    expect(at8).toEqual({
      newCount: 8,
      newCourtCount: 2,
      newCapacity: 8,
      newStatus: "Full",
    });
  });

  test("chains across multiple courts for a bulk increment", () => {
    const out = computeRegistrationIncrement(
      { ...base, registeredCount: 0, maxCourts: 3 },
      7,
    );
    // 7 ≥ 4−1 → court 2; 7 ≥ 8−1 → court 3; 7 < 12−1 → stop.
    expect(out.newCourtCount).toBe(3);
    expect(out.newCapacity).toBe(12);
    expect(out.newStatus).toBe("Open");
  });

  test("preserves a non-Open status while below capacity", () => {
    const out = computeRegistrationIncrement(
      { ...base, registeredCount: 0, status: "Cancelled" },
      1,
    );
    expect(out.newStatus).toBe("Cancelled");
  });
});
