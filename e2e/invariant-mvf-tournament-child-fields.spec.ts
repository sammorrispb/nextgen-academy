import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// MVF Junior Tournament child-field exception (D7, Sam 2026-09-29). The MVF
// checkout collects a child's last name, full DOB, allergies and emergency
// contact, beyond the first-name + birth-year baseline, and the "paid" notice
// carries the DOB, allergies and emergency contact to MVF's partner contact.
// Sam approved exactly those fields and recipients; a new field, destination
// or recipient needs its own approval (docs/source-inventory.md risk log #12).
//
// Source pins, not behaviour: the paid notice lives in the Stripe webhook's
// invoice.paid branch, which the pure suite can't drive end to end. Each test
// extracts the one block it guards and compares its field set exactly, so an
// added field turns it red as surely as a removed one.

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

function between(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  expect(i, `block start not found: ${start}`).toBeGreaterThan(-1);
  const j = src.indexOf(end, i);
  expect(j, `block end not found: ${end}`).toBeGreaterThan(i);
  return src.slice(i, j);
}

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

test.describe("MVF tournament child fields — the approved exception, pinned", () => {
  test("checkout sends exactly the approved child fields to Stripe metadata", () => {
    const src = read("src", "app", "api", "checkout-mvf-junior-tournament", "route.ts");
    const block = between(src, "metadata: {", "memo:");
    const childKeys = [...block.matchAll(/^\s*(child_\w+|emergency_\w+|allergies)\s*:/gm)].map((m) => m[1]);
    expect(sorted(childKeys)).toEqual(
      sorted(["child_first_name", "child_last_name", "child_dob", "emergency_name", "emergency_phone", "allergies"]),
    );
  });

  test("the Notion roster row holds exactly the approved child properties", () => {
    const src = read("src", "lib", "notion-mvf-tournament-registrations.ts");
    // Property keys are quoted when they contain a space ("Child DOB") and bare
    // when they don't (Allergies).
    const props = [...src.matchAll(/(?:"((?:Child|Emergency)[^"]*|Allergies)"|\b(Allergies))\s*:/g)].map(
      (m) => m[1] ?? m[2],
    );
    expect(sorted(props)).toEqual(
      sorted(["Child First Name", "Child Last Name", "Child DOB", "Emergency Name", "Emergency Phone", "Allergies"]),
    );
  });

  test("the paid notice goes to Sam's inboxes and MVF's one partner contact, and no other send reaches MVF", () => {
    const src = read("src", "app", "api", "stripe", "webhook", "route.ts");
    expect(src).toMatch(/const MVF_PARTNER_EMAIL = "malvero@mvf\.org";/);
    expect(src).toMatch(/const ADMIN_NOTIFY = \[ADMIN_EMAIL, "sam\.morris2131@gmail\.com"\];/);
    const partnerSends = src.match(/to:\s*\[[^\]]*MVF_PARTNER_EMAIL[^\]]*\]/g) ?? [];
    expect(partnerSends).toEqual(["to: [...ADMIN_NOTIFY, MVF_PARTNER_EMAIL]"]);
  });

  test("the paid notice carries exactly the approved fields", () => {
    const src = read("src", "app", "api", "stripe", "webhook", "route.ts");
    const block = between(src, "to: [...ADMIN_NOTIFY, MVF_PARTNER_EMAIL]", '].join("\\n")');
    const keys = [...block.matchAll(/metaString\(m, "([^"]+)"\)/g)].map((m) => m[1]);
    expect(sorted(keys)).toEqual(
      sorted([
        "division_label",
        "parent_name",
        "parent_phone",
        "child_dob",
        "emergency_name",
        "emergency_phone",
        "allergies",
        "nga_share_usd",
        "mvf_share_usd",
      ]),
    );
  });

  test("the invoice-sent notice (also to MVF) carries no DOB, allergies or emergency contact", () => {
    const src = read("src", "lib", "signup-admin-notify.ts");
    expect(src).not.toMatch(/dob|allerg|emergency/i);
  });
});
