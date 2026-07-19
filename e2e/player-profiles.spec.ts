import { test, expect } from "@playwright/test";
import {
  encodeParentKey,
  decodeParentKey,
  buildFamilyProfile,
  buildFamilyDirectory,
  toSearchIndex,
} from "../src/lib/player-profiles";
import type { DropInRegistration } from "../src/lib/notion-dropins";

function row(over: Partial<DropInRegistration>): DropInRegistration {
  return {
    id: Math.random().toString(36).slice(2),
    url: "",
    parentName: "Lauren Porter",
    parentEmail: "lauren@example.com",
    parentPhone: "2407801755",
    childFirstName: "Preston",
    childBirthYear: 2015,
    sessionTitle: "Walter Johnson HS — Early",
    sessionDate: "2026-05-23",
    sessionStartTime: "4:30 PM",
    sessionRowId: "",
    location: "Walter Johnson HS, Bethesda, MD",
    publicArea: "",
    locationHidden: false,
    amountPaidUsd: 40,
    status: "Confirmed",
    paidAt: "",
    displayConsent: false,
    smsConsent: false,
    stripeCheckoutSessionId: "cs_x",
    stripePaymentIntentId: "pi_x",
    reminderSent: false,
    postSessionSent: false,
    cancellationNotified: false,
    rescheduleNotified: false,
    locationRevealed: false,
    attendance: "",
    ...over,
  };
}

test.describe("parent key encode/decode", () => {
  test("email round-trips and is case-insensitive", () => {
    const k = encodeParentKey("Lauren@Example.com", "");
    expect(decodeParentKey(k)).toEqual({ email: "lauren@example.com", phone: "" });
  });

  test("falls back to phone digits when no email", () => {
    const k = encodeParentKey("", "(240) 780-1755");
    expect(decodeParentKey(k)).toEqual({ email: "", phone: "2407801755" });
  });

  test("two contacts for the same parent collapse to the same key", () => {
    expect(encodeParentKey("a@b.com", "111")).toBe(encodeParentKey("a@b.com", "999"));
  });

  test("garbage key decodes to null", () => {
    expect(decodeParentKey("!!!notbase64!!!")).toBeNull();
  });
});

test.describe("buildFamilyProfile", () => {
  test("returns null for an empty roster", () => {
    expect(buildFamilyProfile([], "k")).toBeNull();
  });

  test("groups multiple children under one family and tallies per child", () => {
    const rows = [
      row({ childFirstName: "Preston", attendance: "Present" }),
      row({ childFirstName: "Preston", sessionDate: "2026-05-16", attendance: "No-show" }),
      row({ childFirstName: "Maya", childBirthYear: 2017, attendance: "Present" }),
    ];
    const p = buildFamilyProfile(rows, "k")!;
    expect(p.children.map((c) => c.childFirstName).sort()).toEqual(["Maya", "Preston"]);
    expect(p.lifetimeRegistrations).toBe(3);
    expect(p.attended).toBe(2);
    expect(p.noShow).toBe(1);

    const preston = p.children.find((c) => c.childFirstName === "Preston")!;
    expect(preston.attended).toBe(1);
    expect(preston.noShow).toBe(1);
  });

  test("payment totals exclude refunded rows from held, count them as refunded", () => {
    const rows = [
      row({ status: "Confirmed", amountPaidUsd: 40 }),
      row({ status: "Refunded", amountPaidUsd: 40, sessionDate: "2026-05-09" }),
      row({ status: "Cancelled", amountPaidUsd: 40, sessionDate: "2026-05-02" }),
    ];
    const p = buildFamilyProfile(rows, "k")!;
    expect(p.paidUsd).toBe(40); // only the Confirmed row is currently held
    expect(p.refundedUsd).toBe(40); // the Refunded row
  });

  test("events are sorted newest first", () => {
    const rows = [
      row({ sessionDate: "2026-05-02" }),
      row({ sessionDate: "2026-05-30" }),
      row({ sessionDate: "2026-05-16" }),
    ];
    const p = buildFamilyProfile(rows, "k")!;
    expect(p.children[0].events.map((e) => e.sessionDate)).toEqual([
      "2026-05-30",
      "2026-05-16",
      "2026-05-02",
    ]);
  });
});

test.describe("buildFamilyDirectory", () => {
  test("collapses rows into one entry per family, newest activity first", () => {
    const rows = [
      row({ parentEmail: "a@b.com", childFirstName: "Preston", sessionDate: "2026-05-23" }),
      row({ parentEmail: "a@b.com", childFirstName: "Maya", sessionDate: "2026-05-16" }),
      row({ parentEmail: "c@d.com", parentName: "Other Parent", childFirstName: "Sam", sessionDate: "2026-05-30" }),
    ];
    const dir = buildFamilyDirectory(rows);
    expect(dir).toHaveLength(2);
    expect(dir[0].parentName).toBe("Other Parent"); // 5/30 is most recent
    const porter = dir.find((d) => d.parentName === "Lauren Porter")!;
    expect(porter.childNames.sort()).toEqual(["Maya", "Preston"]);
    expect(porter.registrations).toBe(2);
  });

  test("carries child birth years, first-session, and last-attended dates", () => {
    const rows = [
      row({ childFirstName: "Preston", childBirthYear: 2015, sessionDate: "2026-05-02", attendance: "Present" }),
      row({ childFirstName: "Preston", childBirthYear: 2015, sessionDate: "2026-05-23", attendance: "No-show" }),
      row({ childFirstName: "Maya", childBirthYear: 2017, sessionDate: "2026-05-16", attendance: "Present" }),
    ];
    const dir = buildFamilyDirectory(rows);
    expect(dir).toHaveLength(1);
    const fam = dir[0];
    expect(fam.firstSessionDate).toBe("2026-05-02");
    expect(fam.lastSessionDate).toBe("2026-05-23");
    // Latest Present date across the family (Preston 5/02, Maya 5/16) — the
    // 5/23 row was a No-show and must not count as attended.
    expect(fam.lastAttendedDate).toBe("2026-05-16");
    expect(
      fam.children.map((c) => `${c.name}:${c.birthYear}`).sort(),
    ).toEqual(["Maya:2017", "Preston:2015"]);
  });
});

test.describe("toSearchIndex", () => {
  test("projects to key + parent + child names ONLY (no contact info leaks)", () => {
    const rows = [
      row({ parentEmail: "kathy@example.com", parentPhone: "2404476826", childFirstName: "Ethan", childBirthYear: 2012 }),
    ];
    const index = toSearchIndex(buildFamilyDirectory(rows));
    expect(index).toHaveLength(1);
    expect(Object.keys(index[0]).sort()).toEqual(["childNames", "key", "parentName"]);
    const serialized = JSON.stringify(index);
    expect(serialized).not.toContain("kathy@example.com");
    expect(serialized).not.toContain("2404476826");
    expect(serialized).not.toContain("2012");
  });
});
