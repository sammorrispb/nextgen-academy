import { test, expect } from "@playwright/test";
import {
  classifyLead,
  isMailable,
  isTestOrInternal,
  type LeadRow,
} from "../src/lib/lead-segmentation";

const clean: LeadRow = {
  parentEmail: "parent@example.com",
  source: "Website",
  crEventsAttended: null,
  crEventHistory: "",
  lastCrEvent: "",
  season: "Spring 2026",
  notes: "Lead form submission. utm_source: peachjar",
};

test.describe("classifyLead — DD provenance", () => {
  test("eligible: clean own-marketing source", () => {
    expect(classifyLead(clean).bucket).toBe("eligible");
    expect(classifyLead({ ...clean, source: "Facebook Ad" }).bucket).toBe("eligible");
    expect(classifyLead({ ...clean, source: "Website Lead Form" }).bucket).toBe("eligible");
  });

  test("off_limits: CourtReserve / Google Sheet source", () => {
    expect(classifyLead({ ...clean, source: "CourtReserve" }).bucket).toBe("off_limits");
    expect(classifyLead({ ...clean, source: "Google Sheet" }).bucket).toBe("off_limits");
  });

  test("off_limits: any CR event history beats a clean source", () => {
    expect(classifyLead({ ...clean, crEventsAttended: 3 }).bucket).toBe("off_limits");
    expect(classifyLead({ ...clean, crEventHistory: "RV Skills Series" }).bucket).toBe("off_limits");
    expect(classifyLead({ ...clean, lastCrEvent: "NB Mon 5:30" }).bucket).toBe("off_limits");
  });

  test("off_limits: DD-era season", () => {
    expect(classifyLead({ ...clean, season: "Fall 2025" }).bucket).toBe("off_limits");
    expect(classifyLead({ ...clean, season: "Winter 2026" }).bucket).toBe("off_limits");
  });

  test("off_limits: DD/CR mention in notes", () => {
    expect(classifyLead({ ...clean, source: "", notes: "from CourtReserve roster" }).bucket).toBe("off_limits");
    expect(classifyLead({ ...clean, source: "", notes: "played at Dill Dinkers" }).bucket).toBe("off_limits");
  });

  test("ambiguous: no DD signal but empty/unverifiable source", () => {
    expect(classifyLead({ ...clean, source: "" }).bucket).toBe("ambiguous");
    expect(classifyLead({ ...clean, source: "Evaluation" }).bucket).toBe("ambiguous");
    expect(classifyLead({ ...clean, source: "Referral" }).bucket).toBe("ambiguous");
  });

  test("DD signal wins even with an eligible source", () => {
    expect(
      classifyLead({ ...clean, source: "Website", crEventsAttended: 2 }).bucket,
    ).toBe("off_limits");
  });
});

test.describe("isTestOrInternal", () => {
  test("excludes QA / internal / Sam's-own rows", () => {
    expect(isTestOrInternal("Test Tester", "sam.mo88@yahoo.com")).toBe(true);
    expect(isTestOrInternal("Test Lead Wiring", "sam.morris2131+nga-test-2026-04-16@gmail.com")).toBe(true);
    expect(isTestOrInternal("Test OB NGA Parent", "test.ob.nga@example.com")).toBe(true);
    expect(isTestOrInternal("Test Parent", "nextgenacademypb@gmail.com")).toBe(true);
    expect(isTestOrInternal("Sam Morris", "sam.morris2131@gmail.com")).toBe(true);
  });
  test("passes real parents through", () => {
    expect(isTestOrInternal("Jen Holmes", "jenholmes80@yahoo.com")).toBe(false);
    expect(isTestOrInternal("Vivian Lee", "viviankimlee@yahoo.com")).toBe(false);
  });
});

test.describe("isMailable", () => {
  test("accepts valid emails, rejects junk", () => {
    expect(isMailable("a@b.com")).toBe(true);
    expect(isMailable("")).toBe(false);
    expect(isMailable("nope")).toBe(false);
    expect(isMailable("3015551234")).toBe(false);
  });
});
