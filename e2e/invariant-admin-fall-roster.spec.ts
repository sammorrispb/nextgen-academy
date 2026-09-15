import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  buildFallGroupMailto,
  countConfirmedByGroup,
  toAdminFallPlayer,
  type AdminFallPlayer,
} from "../src/lib/admin-fall-roster";
import {
  fetchFallRoster,
  fetchFallRegistrationKeys,
  type FallRosterRow,
} from "../src/lib/notion-fall-registrations";
import { fallSeasonSlotsFor } from "../src/data/fall-season-2026";

// /admin/fall is a NEW read surface for child PII — the fall equivalent of
// /admin/monday-girls, pinned the same way plus the one invariant this season
// has and that one does not: Green and Yellow hold DIFFERENT seat counts.
//
//  1. The projection DROPS the day-of safety fields (allergies, emergency
//     contact, the stored SMS consent text). The admin side manages
//     registrations and money; day-of safety belongs on a coach surface.
//  2. The read FAILS LOUD. `fetchFallRegistrationKeys` fails OPEN (an empty
//     array) on purpose — it gates checkout and a Notion blip must not block a
//     sale. An admin roster inherits the opposite duty, so it is a SEPARATE
//     function with a discriminated status. Both postures are asserted here so
//     a later "cleanup" cannot merge them.
//  3. Seats are PER GROUP. A single shared count is the exact bug
//     invariant-fall-seat-cap-per-group.spec.ts exists for.
//  4. The group email is bcc-only and Confirmed-only — parents never see each
//     other's addresses, and a refunded family is not mailed about a season
//     they left.
//
// Pure — no dev server:
//   npx playwright test e2e/invariant-admin-fall-roster.spec.ts --project=desktop

const ROSTER_DB = "fall-admin-roster-db";

const FULL_ROW: FallRosterRow = {
  pageId: "page_abc",
  parentName: "Dana Parent",
  parentEmail: "dana@example.com",
  parentPhone: "+13015550000",
  childFirstName: "Mia",
  childBirthYear: 2014,
  group: "Green",
  status: "Confirmed",
  amountPaidUsd: 225,
  allergies: "SENTINEL_PEANUT_ALLERGY",
  emergencyName: "SENTINEL_EMERGENCY_NAME",
  emergencyPhone: "SENTINEL_EMERGENCY_PHONE",
  smsConsent: true,
  smsConsentText: "SENTINEL_CONSENT_TEXT",
  stripeCheckoutSessionId: "cs_test_abc",
  registeredOnIso: "2026-08-20",
};

/* ---------- 1. the projection narrows ---------------------------------- */

const ALLOWED_KEYS: (keyof AdminFallPlayer)[] = [
  "pageId",
  "parentName",
  "parentEmail",
  "parentPhone",
  "childFirstName",
  "childBirthYear",
  "group",
  "status",
  "amountPaidUsd",
  "registeredOnIso",
  "smsConsent",
  "stripeCheckoutSessionId",
];

test.describe("admin fall projection", () => {
  test("omits allergies, emergency contact and the consent text", () => {
    const out = toAdminFallPlayer(FULL_ROW);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("SENTINEL_PEANUT_ALLERGY");
    expect(serialized).not.toContain("SENTINEL_EMERGENCY_NAME");
    expect(serialized).not.toContain("SENTINEL_EMERGENCY_PHONE");
    expect(serialized).not.toContain("SENTINEL_CONSENT_TEXT");
    expect(Object.keys(out).sort()).toEqual([...ALLOWED_KEYS].sort());
  });

  test("still carries what the admin table is for", () => {
    const out = toAdminFallPlayer(FULL_ROW);
    expect(out.childFirstName).toBe("Mia");
    expect(out.parentEmail).toBe("dana@example.com");
    expect(out.status).toBe("Confirmed");
    expect(out.amountPaidUsd).toBe(225);
    expect(out.stripeCheckoutSessionId).toBe("cs_test_abc");
    expect(out.smsConsent).toBe(true);
  });
});

/* ---------- 2. seats are per group, never one shared number ------------ */

test.describe("per-group capacity", () => {
  test("Green and Yellow hold different counts, read from the season data", () => {
    // If these ever collapse to one number the page is free to render a single
    // "N of M" and oversell a group — the bug
    // invariant-fall-seat-cap-per-group.spec.ts was written for.
    expect(fallSeasonSlotsFor("Green")).toBe(8);
    expect(fallSeasonSlotsFor("Yellow")).toBe(10);
    expect(fallSeasonSlotsFor("Green")).not.toBe(fallSeasonSlotsFor("Yellow"));
  });

  test("counts Confirmed rows per group — refunded rows hold no seat", () => {
    const players = [
      toAdminFallPlayer(FULL_ROW),
      toAdminFallPlayer({ ...FULL_ROW, pageId: "p2", group: "Yellow" }),
      toAdminFallPlayer({ ...FULL_ROW, pageId: "p3", group: "Yellow" }),
      toAdminFallPlayer({ ...FULL_ROW, pageId: "p4", group: "Yellow", status: "Refunded" }),
    ];
    expect(countConfirmedByGroup(players, "Green")).toBe(1);
    expect(countConfirmedByGroup(players, "Yellow")).toBe(2);
  });
});

/* ---------- 3. the group email is bcc-only and Confirmed-only ---------- */

test.describe("group email", () => {
  test("puts every parent in bcc — never in to=", () => {
    const players = [
      toAdminFallPlayer(FULL_ROW),
      toAdminFallPlayer({ ...FULL_ROW, pageId: "p2", parentEmail: "second@example.com" }),
    ];
    const href = buildFallGroupMailto(players, "Green") ?? "";
    expect(href).toContain("bcc=");
    expect(href).not.toMatch(/mailto:[^?]/);
    expect(href).not.toContain("to=");
    expect(href).toContain("dana@example.com");
    expect(href).toContain("second@example.com");
  });

  test("mails Confirmed families only, deduped", () => {
    const players = [
      toAdminFallPlayer(FULL_ROW),
      toAdminFallPlayer({ ...FULL_ROW, pageId: "p2" }), // same email again
      toAdminFallPlayer({
        ...FULL_ROW,
        pageId: "p3",
        parentEmail: "refunded@example.com",
        status: "Refunded",
      }),
      toAdminFallPlayer({
        ...FULL_ROW,
        pageId: "p4",
        parentEmail: "other-group@example.com",
        group: "Yellow",
      }),
    ];
    const href = buildFallGroupMailto(players, "Green") ?? "";
    expect(href).not.toContain("refunded@example.com");
    expect(href).not.toContain("other-group@example.com");
    const bcc = decodeURIComponent(href.split("bcc=")[1]?.split("&")[0] ?? "");
    expect(bcc.split(",")).toEqual(["dana@example.com"]);
  });

  test("carries no child name or safety field into the URL", () => {
    const href = buildFallGroupMailto([toAdminFallPlayer(FULL_ROW)], "Green") ?? "";
    const decoded = decodeURIComponent(href);
    expect(decoded).not.toContain("Mia");
    expect(decoded).not.toContain("SENTINEL_PEANUT_ALLERGY");
  });

  test("no valid recipient ⇒ null, so the page renders no dead button", () => {
    expect(buildFallGroupMailto([], "Green")).toBeNull();
    expect(
      buildFallGroupMailto([toAdminFallPlayer({ ...FULL_ROW, parentEmail: "" })], "Green"),
    ).toBeNull();
  });
});

/* ---------- 4. the read fails loud, never empty-and-green -------------- */

test.describe("admin fall roster read", () => {
  const stub = new FetchStub();

  test.beforeEach(() => {
    stub.reset();
    stub.install();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_FALL_REGS_DB_ID = ROSTER_DB;
  });

  test.afterEach(() => {
    stub.uninstall();
  });

  test("env unset ⇒ config_missing with ZERO network calls", async () => {
    delete process.env.NOTION_FALL_REGS_DB_ID;
    const res = await fetchFallRoster();
    expect(res.status).toBe("config_missing");
    expect(stub.calls).toHaveLength(0);
  });

  test("a Notion failure reports query_failed — NEVER an empty ok roster", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, { message: "boom" }, 500);
    const res = await fetchFallRoster();
    expect(res.status).toBe("query_failed");
    expect(JSON.stringify(res)).not.toContain('"rows":[]');
  });

  test("a thrown fetch also reports query_failed rather than throwing", async () => {
    // No rule registered ⇒ the stub throws. The page must render an error.
    const res = await fetchFallRoster();
    expect(res.status).toBe("query_failed");
  });

  test("the checkout-side key fetch still fails OPEN — the two postures stay apart", async () => {
    // Deliberately asserted next to the one above: merging these two readers
    // would either block sales on a Notion blip or tell Sam nobody registered.
    stub.on(`/databases/${ROSTER_DB}/query`, { message: "boom" }, 500);
    await expect(fetchFallRegistrationKeys("Green")).resolves.toEqual([]);
  });

  test("ok ⇒ rows parsed across both groups, including a refunded row", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, {
      results: [
        {
          id: "page_1",
          created_time: "2026-08-20T17:06:22.000Z",
          properties: {
            "Parent Name": { title: [{ plain_text: "Andrea Example" }] },
            "Parent Email": { email: "andrea@example.com" },
            "Parent Phone": { phone_number: "8105550000" },
            "Child First Name": { rich_text: [{ plain_text: "Grace" }] },
            "Child Birth Year": { number: 2014 },
            Group: { select: { name: "Green" } },
            Status: { select: { name: "Confirmed" } },
            "Amount Paid": { number: 225 },
            Allergies: { rich_text: [{ plain_text: "SENTINEL_ALLERGY" }] },
            "Emergency Name": { rich_text: [{ plain_text: "SENTINEL_EMER" }] },
            "Emergency Phone": { phone_number: "8105550001" },
            "SMS Consent": { checkbox: true },
            "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_1" }] },
          },
        },
        {
          id: "page_2",
          created_time: "2026-09-01T14:00:00.000Z",
          properties: {
            "Parent Name": { title: [{ plain_text: "Left Season" }] },
            "Parent Email": { email: "left@example.com" },
            Status: { select: { name: "Refunded" } },
            "Amount Paid": { number: 225 },
            Group: { select: { name: "Yellow" } },
            "Child First Name": { rich_text: [{ plain_text: "Nora" }] },
          },
        },
      ],
    });

    const res = await fetchFallRoster();
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;

    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].childFirstName).toBe("Grace");
    expect(res.rows[0].registeredOnIso).toBe("2026-08-20");
    expect(res.rows[0].group).toBe("Green");
    expect(res.rows[1].status).toBe("Refunded");

    // A refunded row is still READ — the admin needs to see it — but the
    // projection is what reaches the page, and it stays narrow.
    const serialized = JSON.stringify(res.rows.map(toAdminFallPlayer));
    expect(serialized).not.toContain("SENTINEL_ALLERGY");
    expect(serialized).not.toContain("SENTINEL_EMER");
    expect(serialized).not.toContain("8105550001");
  });

  test("follows Notion's cursor rather than truncating the roster", async () => {
    let call = 0;
    stub.on(`/databases/${ROSTER_DB}/query`, () => {
      call += 1;
      return call === 1
        ? {
            results: [{ id: "p1", properties: { Group: { select: { name: "Green" } } } }],
            has_more: true,
            next_cursor: "cursor_2",
          }
        : {
            results: [{ id: "p2", properties: { Group: { select: { name: "Yellow" } } } }],
            has_more: false,
            next_cursor: null,
          };
    });
    const res = await fetchFallRoster();
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.rows).toHaveLength(2);
    expect(stub.calls.length).toBeGreaterThan(1);
    expect(stub.calls[1].body).toContain("cursor_2");
  });

  test("reads Notion and nothing else", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, { results: [] });
    await fetchFallRoster();
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const c of stub.calls) {
      expect(c.url).toContain("api.notion.com");
    }
  });

  test("never writes — every call is a query, never a page create or patch", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, { results: [] });
    await fetchFallRoster();
    for (const c of stub.calls) {
      expect(c.method).not.toBe("PATCH");
      expect(c.url).not.toMatch(/\/v1\/pages\b/);
    }
  });
});

/* ---------- 5. the page is gated ---------------------------------------- */

test.describe("admin fall page is behind the admin gate", () => {
  const pagePath = path.join(process.cwd(), "src/app/admin/(authed)/fall/page.tsx");

  test("lives under the (authed) segment, which is what enforces the cookie", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  test("carries no admin-secret bypass of its own", () => {
    const src = fs.readFileSync(pagePath, "utf8");
    expect(src).not.toContain("NGA_ADMIN_SECRET");
    expect(src).not.toContain("SESSION_OPS_SECRET");
  });

  test("is force-dynamic — a roster must never sit in the ISR cache", () => {
    const src = fs.readFileSync(pagePath, "utf8");
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });

  test("verifies the admin session BEFORE it reads the roster", () => {
    // Carried over from the live leak PR #338 found on /admin/monday-girls the
    // same day this page was written: an unauthenticated GET returned
    // 307 -> /admin/login whose RESPONSE BODY held the whole roster, because a
    // layout and its page render CONCURRENTLY in the App Router — the layout's
    // redirect set the status while the page had already hit Notion and
    // rendered the table. A page that server-renders child PII must gate
    // itself, ahead of the fetch, so an unauthenticated request has nothing to
    // serialize. This page renders first names and birth years, so it is in
    // exactly that class.
    const src = fs.readFileSync(pagePath, "utf8");
    const gate = src.indexOf("requireAdmin(");
    const read = src.indexOf("fetchFallRoster(");
    expect(gate, "page must call requireAdmin()").toBeGreaterThan(-1);
    expect(read, "page must read the roster").toBeGreaterThan(-1);
    expect(
      gate,
      "requireAdmin() must be awaited BEFORE the Notion read",
    ).toBeLessThan(read);
  });

  test("renders the roster through the narrowing projection, not the raw row", () => {
    const src = fs.readFileSync(pagePath, "utf8");
    expect(src).toContain("toAdminFallPlayer");
    expect(src).not.toContain("allergies");
    expect(src).not.toContain("emergencyName");
  });
});
