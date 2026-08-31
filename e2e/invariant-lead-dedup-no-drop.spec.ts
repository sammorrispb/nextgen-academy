import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE the route module reads it (all reads are lazy/at-call).
process.env.NOTION_API_KEY = "ntn_test_leaddedup";
process.env.NOTION_PLAYER_CRM_DB_ID = "lead-dedup-crm-db";
process.env.RESEND_API_KEY = "re_test_leaddedup";
// Left UNSET on purpose so ingestToOpenBrain self-skips: this spec is about the
// Notion write, and an OB call would just add noise to the egress assertion.
delete process.env.OPEN_BRAIN_INGEST_URL;

import { POST as leadPOST } from "../src/app/api/lead/route";

// THE dedup invariant.
//
// /api/lead dedups on PARENT email. Before this spec, a returning family hit
// that branch and the route wrote NOTHING — no row created, no row updated —
// so a second child, a changed location and fresh parent notes were dropped on
// the floor while the admin email still rendered every field in full. The only
// tell was the "Notion CRM: already exists" line nobody reads.
//
// A repeat inquiry is the single most valuable lead we get. It must never be a
// no-op again.
const KNOWN_PARENT = "returning@leaddedup.test";
const EXISTING_PAGE = "page-existing-kid";

function existingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXISTING_PAGE,
    properties: {
      "Player Name": { title: [{ plain_text: "Fabian" }] },
      "Parent Email": { email: KNOWN_PARENT },
      Notes: { rich_text: [{ plain_text: "Lead form submission. Child age: 11" }] },
      Level: { select: { name: "Eval Needed" } },
      Status: { select: { name: "Lead" } },
      ...overrides,
    },
  };
}

function installWorld(stub: FetchStub, rows: unknown[] = [existingRow()]) {
  stub
    .on("databases/lead-dedup-crm-db/query", { results: rows, has_more: false })
    .on(/\/pages\/[^/]+$/, { id: EXISTING_PAGE, properties: {} })
    .on("api.notion.com/v1/pages", { id: "page-new" })
    .on("api.resend.com", { id: "email_test" })
    .install();
}

function leadRequest(body: Record<string, unknown>) {
  return new NextRequest("https://nextgenpbacademy.com/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
    body: JSON.stringify(body),
  });
}

// The route rate-limits 5/hr per IP in a module-level map that persists across
// tests in this file — vary the IP so test N+1 isn't a 429.
let ipSeq = 0;
function randomIp() {
  return `203.0.113.${++ipSeq}`;
}

function submission(kids: Array<{ name: string; age: number }>, extra = {}) {
  return {
    parentName: "Juan Uribe",
    contact: KNOWN_PARENT,
    kids,
    notes: "He is a 3+ year tennis player that is new to pickleball",
    ...extra,
  };
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

function patchCalls() {
  return stub.calls.filter((c) => c.method === "PATCH" && /\/pages\//.test(c.url));
}
function createCalls() {
  return stub.calls.filter((c) => c.method === "POST" && /\/v1\/pages$/.test(c.url));
}

test.describe("lead dedup — a repeat inquiry is never dropped", () => {
  test("a returning parent's inquiry UPDATES the existing row", async () => {
    installWorld(stub);
    const res = await leadPOST(submissionRequest([{ name: "Fabian", age: 11 }]));
    expect(res.status).toBe(200);

    const patches = patchCalls();
    expect(
      patches.length,
      "a repeat inquiry from a known parent must PATCH the CRM row, not silently no-op",
    ).toBeGreaterThan(0);

    const body = JSON.parse(patches[0].body);
    expect(body.properties.Notes, "the new inquiry must be appended to Notes").toBeTruthy();
    expect(body.properties["Last Contact Date"].date.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("the appended note carries the parent's own words", async () => {
    installWorld(stub);
    await leadPOST(submissionRequest([{ name: "Fabian", age: 11 }]));

    const body = JSON.parse(patchCalls()[0].body);
    const notes = body.properties.Notes.rich_text[0].text.content;
    expect(notes, "the original origin line must survive").toContain("Child age: 11");
    expect(notes, "the new inquiry's notes must be captured").toContain(
      "3+ year tennis player",
    );
  });

  test("a NEW child on a known parent gets their own row", async () => {
    installWorld(stub);
    await leadPOST(submissionRequest([{ name: "Sofia", age: 8 }]));

    expect(
      createCalls().length,
      "a sibling we have never seen must get a CRM row, not vanish into the email",
    ).toBe(1);
  });

  test("a child we already have is not duplicated", async () => {
    installWorld(stub);
    await leadPOST(submissionRequest([{ name: "fabian", age: 11 }]));

    expect(
      createCalls().length,
      "same child (case-insensitive) must not create a second row",
    ).toBe(0);
  });

  test("never rewrites Status or Level — those are coach judgment", async () => {
    installWorld(stub);
    await leadPOST(submissionRequest([{ name: "Fabian", age: 11 }]));

    for (const call of patchCalls()) {
      const props = JSON.parse(call.body).properties ?? {};
      expect(Object.keys(props), "Status is the coach's to set").not.toContain("Status");
      expect(Object.keys(props), "Level is the coach's to set").not.toContain("Level");
    }
  });

  test("never overwrites a Location an operator already set", async () => {
    installWorld(stub, [
      existingRow({ Location: { select: { name: "Rockville" } } }),
    ]);
    await leadPOST(
      submissionRequest([{ name: "Fabian", age: 11 }], {
        location: "Frederick — The Pickl Park",
      }),
    );

    for (const call of patchCalls()) {
      const props = JSON.parse(call.body).properties ?? {};
      expect(
        Object.keys(props),
        "a non-empty Location outranks anything the form derived",
      ).not.toContain("Location");
    }
  });

  test("fills an EMPTY Location from the submission", async () => {
    installWorld(stub);
    await leadPOST(
      submissionRequest([{ name: "Fabian", age: 11 }], {
        location: "Frederick — The Pickl Park",
      }),
    );

    const props = JSON.parse(patchCalls()[0].body).properties;
    expect(props.Location.select.name).toBe("Frederick — The Pickl Park");
  });
});

function submissionRequest(
  kids: Array<{ name: string; age: number }>,
  extra: Record<string, unknown> = {},
) {
  return leadRequest(submission(kids, extra));
}
