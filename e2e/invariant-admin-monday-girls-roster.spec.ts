import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  toAdminMondayGirlsPlayer,
  type AdminMondayGirlsPlayer,
} from "../src/lib/admin-monday-girls-roster";
import {
  fetchMondayGirlsRoster,
  type MondayGirlsRosterRow,
} from "../src/lib/notion-monday-girls-registrations";
import { MONDAY_GIRLS_MONDAYS } from "../src/data/monday-girls-2026";

// The /admin/monday-girls roster is a NEW read surface for child PII, so it is
// pinned the way the admin camps roster is — plus one invariant camps does not
// need, because this roster comes from Notion rather than Stripe:
//
//  1. The projection DROPS the day-of safety fields (allergies, emergency
//     contact), exactly as `admin-camp-roster.ts` does. The admin side manages
//     registrations and money; day-of safety belongs to a coach surface.
//  2. The read FAILS LOUD. `fetchMondayGirlsRegistrationKeys` fails OPEN (an
//     empty array) on purpose — it gates checkout, and a Notion blip must not
//     block a sale. An admin roster inherits the opposite duty: an empty table
//     that actually means "Notion is down" would tell Sam nobody registered.
//     So the roster read is a SEPARATE function with a discriminated status.
//  3. It never reaches the network when the DB env is unset.
//
// Pure — no dev server:
//   npx playwright test e2e/invariant-admin-monday-girls-roster.spec.ts --project=desktop

const ROSTER_DB = "monday-girls-admin-roster-db";

const FULL_ROW: MondayGirlsRosterRow = {
  pageId: "page_abc",
  parentName: "Dana Parent",
  parentEmail: "dana@example.com",
  parentPhone: "+13015550000",
  childFirstName: "Mia",
  childBirthYear: 2017,
  group: "Girls Beginner",
  status: "Confirmed",
  amountPaidUsd: 225,
  allergies: "SENTINEL_PEANUT_ALLERGY",
  emergencyName: "SENTINEL_EMERGENCY_NAME",
  emergencyPhone: "SENTINEL_EMERGENCY_PHONE",
  smsConsent: true,
  stripeCheckoutSessionId: "cs_test_abc",
  registeredOnIso: "2026-09-08",
};

/* ---------- 1. the projection narrows ---------------------------------- */

const ALLOWED_KEYS: (keyof AdminMondayGirlsPlayer)[] = [
  "pageId",
  "parentName",
  "parentEmail",
  "parentPhone",
  "childFirstName",
  "childBirthYear",
  "group",
  "status",
  "amountPaidUsd",
  "sessionsPurchased",
  "registeredOnIso",
  "smsConsent",
  "stripeCheckoutSessionId",
];

test.describe("admin Monday Girls projection", () => {
  test("omits allergies + emergency contact — same rule as the camps roster", () => {
    const out = toAdminMondayGirlsPlayer(FULL_ROW);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("SENTINEL_PEANUT_ALLERGY");
    expect(serialized).not.toContain("SENTINEL_EMERGENCY_NAME");
    expect(serialized).not.toContain("SENTINEL_EMERGENCY_PHONE");
    expect(Object.keys(out).sort()).toEqual([...ALLOWED_KEYS].sort());
  });

  test("still carries what the admin table is for", () => {
    const out = toAdminMondayGirlsPlayer(FULL_ROW);
    expect(out.childFirstName).toBe("Mia");
    expect(out.parentEmail).toBe("dana@example.com");
    expect(out.status).toBe("Confirmed");
    expect(out.amountPaidUsd).toBe(225);
    expect(out.stripeCheckoutSessionId).toBe("cs_test_abc");
  });

  test("derives sessions purchased from the day the family registered", () => {
    // The receipt half of mid-season joining (2026-09-14): a family who bought
    // in week three paid for four Mondays, and the admin table has to show that
    // rather than implying everyone bought the same block.
    const early = toAdminMondayGirlsPlayer({
      ...FULL_ROW,
      registeredOnIso: "2026-09-08",
    });
    expect(early.sessionsPurchased).toBe(MONDAY_GIRLS_MONDAYS.length);

    const late = toAdminMondayGirlsPlayer({
      ...FULL_ROW,
      registeredOnIso: "2026-10-05",
      amountPaidUsd: 150,
    });
    expect(late.sessionsPurchased).toBe(4);
    expect(late.sessionsPurchased).toBeLessThan(MONDAY_GIRLS_MONDAYS.length);
  });
});

/* ---------- 2. the read fails loud, never empty-and-green -------------- */

test.describe("admin Monday Girls roster read", () => {
  const stub = new FetchStub();

  test.beforeEach(() => {
    stub.reset();
    stub.install();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = ROSTER_DB;
  });

  test.afterEach(() => {
    stub.uninstall();
  });

  test("env unset ⇒ config_missing with ZERO network calls", async () => {
    delete process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID;
    const res = await fetchMondayGirlsRoster();
    expect(res.status).toBe("config_missing");
    expect(stub.calls).toHaveLength(0);
  });

  test("a Notion failure reports query_failed — NEVER an empty ok roster", () => {
    // THE invariant this suite exists for. The checkout-side key fetch returns
    // [] on a Notion error by design; if this read copied that, an outage would
    // render a page that says "0 registered" to the person who most needs to
    // know it is 3.
    return (async () => {
      stub.on(`/databases/${ROSTER_DB}/query`, { message: "boom" }, 500);
      const res = await fetchMondayGirlsRoster();
      expect(res.status).toBe("query_failed");
      expect(res.status).not.toBe("ok");
      expect(JSON.stringify(res)).not.toContain('"rows":[]');
    })();
  });

  test("a thrown fetch also reports query_failed rather than throwing", async () => {
    // No rule registered ⇒ the stub throws. The page must render an error, not 500.
    const res = await fetchMondayGirlsRoster();
    expect(res.status).toBe("query_failed");
  });

  test("ok ⇒ rows parsed, including a refunded row", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, {
      results: [
        {
          id: "page_1",
          created_time: "2026-09-08T17:06:22.000Z",
          properties: {
            "Parent Name": { title: [{ plain_text: "Andrea Example" }] },
            "Parent Email": { email: "andrea@example.com" },
            "Parent Phone": { phone_number: "8105550000" },
            "Child First Name": { rich_text: [{ plain_text: "Grace" }] },
            "Child Birth Year": { number: 2018 },
            Group: { select: { name: "Girls Beginner" } },
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
          created_time: "2026-10-05T14:00:00.000Z",
          properties: {
            "Parent Name": { title: [{ plain_text: "Late Joiner" }] },
            "Parent Email": { email: "late@example.com" },
            Status: { select: { name: "Refunded" } },
            "Amount Paid": { number: 150 },
            Group: { select: { name: "Girls Beginner" } },
            "Child First Name": { rich_text: [{ plain_text: "Nora" }] },
          },
        },
      ],
    });

    const res = await fetchMondayGirlsRoster();
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;

    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].childFirstName).toBe("Grace");
    expect(res.rows[0].registeredOnIso).toBe("2026-09-08");
    expect(res.rows[1].status).toBe("Refunded");

    // A refunded row is still READ — the admin needs to see it — but the
    // projection is what reaches the page, and it stays narrow.
    const projected = res.rows.map(toAdminMondayGirlsPlayer);
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain("SENTINEL_ALLERGY");
    expect(serialized).not.toContain("SENTINEL_EMER");
    expect(serialized).not.toContain("8105550001");
  });

  test("reads Notion and nothing else", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, { results: [] });
    await fetchMondayGirlsRoster();
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const c of stub.calls) {
      expect(c.url).toContain("api.notion.com");
    }
  });

  test("never writes — every call is a query, never a page create or patch", async () => {
    stub.on(`/databases/${ROSTER_DB}/query`, { results: [] });
    await fetchMondayGirlsRoster();
    for (const c of stub.calls) {
      expect(c.method).not.toBe("PATCH");
      expect(c.url).not.toMatch(/\/v1\/pages\b/);
    }
  });
});

/* ---------- 3. the page is gated ---------------------------------------- */

test.describe("admin Monday Girls page is behind the admin gate", () => {
  const pagePath = path.join(
    process.cwd(),
    "src/app/admin/(authed)/monday-girls/page.tsx",
  );

  test("lives under the (authed) segment, which is what enforces the cookie", () => {
    // The gate is the route group's layout — a page outside it would be public
    // no matter what it renders.
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
    // THE REGRESSION THIS PINS, found live on 2026-09-15 and reproducible:
    // an unauthenticated GET of /admin/monday-girls returned 307 -> /admin/login
    // whose RESPONSE BODY carried the whole roster — three parent emails and two
    // children's first names.
    //
    // The route group's layout is not enough on its own. In the App Router a
    // layout and its page render CONCURRENTLY, so `redirect()` thrown in the
    // layout sets the status while the page has already run: it hit Notion,
    // rendered the table, and Next serialized that output into the redirect's
    // payload. The gate has to sit in the page, ahead of the fetch, so an
    // unauthenticated request has no roster to serialize in the first place.
    //
    // The sibling gated pages never had this because none of them server-render
    // PII — /admin/sessions defers campers to an authed API route fetched on
    // click. A page that renders child PII directly must gate itself.
    const src = fs.readFileSync(pagePath, "utf8");
    const gate = src.indexOf("requireAdmin(");
    const read = src.indexOf("fetchMondayGirlsRoster(");
    expect(gate, "page must call requireAdmin()").toBeGreaterThan(-1);
    expect(read, "page must read the roster").toBeGreaterThan(-1);
    expect(
      gate,
      "requireAdmin() must be awaited BEFORE the Notion read",
    ).toBeLessThan(read);
  });
});
