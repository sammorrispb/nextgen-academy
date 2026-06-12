import { test, expect } from "@playwright/test";
import { normalizeTitle, partitionRegistrants } from "../src/lib/registrant-match";
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
});
