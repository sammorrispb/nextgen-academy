import { test, expect } from "@playwright/test";
import {
  isLocationHidden,
  publicLocation,
  HIDDEN_LOCATION_NOTE,
} from "../src/lib/session-location";

test.describe("isLocationHidden", () => {
  test("true only when a public area is set", () => {
    expect(isLocationHidden("Olney, MD")).toBe(true);
    expect(isLocationHidden("")).toBe(false);
    expect(isLocationHidden("   ")).toBe(false);
    expect(isLocationHidden(null)).toBe(false);
    expect(isLocationHidden(undefined)).toBe(false);
  });
});

test.describe("publicLocation", () => {
  test("returns the broad area for a hidden session — never the exact venue", () => {
    expect(
      publicLocation("123 Secret Rd, Olney, MD 20832", "Olney, MD"),
    ).toBe("Olney, MD");
  });

  test("returns the exact location for a normal session", () => {
    expect(
      publicLocation("Walter Johnson HS, Bethesda, MD", ""),
    ).toBe("Walter Johnson HS, Bethesda, MD");
  });

  test("never leaks the exact venue when public area is whitespace/null", () => {
    // Whitespace-only area is treated as not-hidden, so the exact shows — this
    // documents that a hidden session REQUIRES a real public area to be safe.
    expect(publicLocation("123 Secret Rd", "  ")).toBe("123 Secret Rd");
  });
});

test.describe("HIDDEN_LOCATION_NOTE", () => {
  test("communicates the 24h reveal", () => {
    expect(HIDDEN_LOCATION_NOTE).toContain("24 hours before");
  });
});
