import { test, expect } from "@playwright/test";
import { publicLocation } from "../src/lib/session-location";

test.describe("publicLocation", () => {
  test("returns the exact venue when it's set", () => {
    expect(
      publicLocation("Walter Johnson HS, Bethesda, MD", "Bethesda, MD"),
    ).toBe("Walter Johnson HS, Bethesda, MD");
  });

  test("falls back to the broad area when the exact venue isn't filled yet", () => {
    expect(publicLocation("", "Olney, MD")).toBe("Olney, MD");
    expect(publicLocation("   ", "Olney, MD")).toBe("Olney, MD");
  });

  test("returns an empty string when neither is set", () => {
    expect(publicLocation("", "")).toBe("");
    expect(publicLocation("   ", null)).toBe("");
    expect(publicLocation("", undefined)).toBe("");
  });
});
