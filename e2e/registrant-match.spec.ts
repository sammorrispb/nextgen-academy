import { test, expect } from "@playwright/test";
import {
  normalizePageId,
  normalizeTitle,
  partitionRegistrants,
} from "../src/lib/registrant-match";
import type { DropInRegistration } from "../src/lib/notion-dropins";

function row(overrides: Partial<DropInRegistration>): DropInRegistration {
  return {
    id: "id",
    url: "",
    parentName: "Parent",
    parentEmail: "parent@example.com",
    parentPhone: "",
    childFirstName: "Kid",
    childBirthYear: 2015,
    sessionTitle: "Redland Tuesday Evening — Orange",
    sessionDate: "2026-06-16",
    sessionStartTime: "6:00 PM",
    sessionRowId: "",
    location: "",
    publicArea: "",
    locationHidden: false,
    amountPaidUsd: 20,
    status: "Confirmed",
    paidAt: "",
    displayConsent: false,
    smsConsent: false,
    stripeCheckoutSessionId: "cs_x",
    stripePaymentIntentId: "pi_x",
    reminderSent: false,
    postSessionSent: false,
    cancellationNotified: false,
    locationRevealed: false,
    attendance: "",
    ...overrides,
  };
}

test.describe("normalizeTitle", () => {
  test("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeTitle("  Walter  Johnson HS ")).toBe("walter johnson hs");
  });
});

test.describe("partitionRegistrants", () => {
  test("matches rows whose stored title differs only by case/whitespace", () => {
    const rows = [row({ sessionTitle: "walter johnson  HS" })];
    const { matched, otherTitleCount } = partitionRegistrants(rows, "Walter Johnson HS");
    expect(matched).toHaveLength(1);
    expect(otherTitleCount).toBe(0);
  });

  test("same-date rows for a different session count as otherTitleCount", () => {
    const rows = [
      row({ id: "a", sessionTitle: "Redland Tuesday Evening — Orange" }),
      row({ id: "b", sessionTitle: "Redland Tuesday Evening — Green" }),
      row({ id: "c", sessionTitle: "Redland Tuesday Evening — Green" }),
    ];
    const { matched, otherTitleCount } = partitionRegistrants(
      rows,
      "Redland Tuesday Evening — Green",
    );
    expect(matched.map((r) => r.id)).toEqual(["b", "c"]);
    expect(otherTitleCount).toBe(1);
  });

  test("sorts Confirmed rows before Refunded/Cancelled, then by child name", () => {
    const rows = [
      row({ id: "refunded", status: "Refunded", childFirstName: "Aaron" }),
      row({ id: "zoe", status: "Confirmed", childFirstName: "Zoe" }),
      row({ id: "ben", status: "Confirmed", childFirstName: "Ben" }),
    ];
    const { matched } = partitionRegistrants(rows, "Redland Tuesday Evening — Orange");
    expect(matched.map((r) => r.id)).toEqual(["ben", "zoe", "refunded"]);
  });

  test("empty input yields empty partition", () => {
    const { matched, otherTitleCount } = partitionRegistrants([], "Anything");
    expect(matched).toEqual([]);
    expect(otherTitleCount).toBe(0);
  });

  test("stamped row ID matches even after the session title is renamed", () => {
    const rows = [
      row({ sessionTitle: "Old Title Before Rename", sessionRowId: "abc-123-def" }),
    ];
    const { matched } = partitionRegistrants(rows, "Completely New Title", "abc123def");
    expect(matched).toHaveLength(1);
  });

  test("stamped row ID beats a coincidental title match for another session", () => {
    const rows = [
      row({ id: "ours", sessionTitle: "Walter Johnson HS", sessionRowId: "session-a" }),
      row({ id: "theirs", sessionTitle: "Walter Johnson HS", sessionRowId: "session-b" }),
    ];
    const { matched, otherTitleCount } = partitionRegistrants(
      rows,
      "Walter Johnson HS",
      "session-a",
    );
    expect(matched.map((r) => r.id)).toEqual(["ours"]);
    expect(otherTitleCount).toBe(1);
  });

  test("legacy rows without a stamped ID fall back to title matching", () => {
    const rows = [
      row({ id: "legacy", sessionTitle: "Walter Johnson HS", sessionRowId: "" }),
      row({ id: "stamped", sessionTitle: "Walter Johnson HS", sessionRowId: "session-a" }),
    ];
    const { matched } = partitionRegistrants(rows, "Walter Johnson HS", "session-a");
    expect(matched.map((r) => r.id).sort()).toEqual(["legacy", "stamped"]);
  });
});

test.describe("normalizePageId", () => {
  test("dashed and undashed Notion IDs compare equal", () => {
    expect(normalizePageId("370FA3AC-27dc-8175-94c5-c015126b5888")).toBe(
      normalizePageId("370fa3ac27dc817594c5c015126b5888"),
    );
  });
});
