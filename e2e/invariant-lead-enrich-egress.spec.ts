import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_enrichegress";
process.env.NOTION_PLAYER_CRM_DB_ID = "enrich-egress-db";
// SET on purpose. Deleting these would make the OB helper self-skip, which
// would prove only that the call didn't happen — not that this path never
// makes it. Same reasoning as invariant-waitlist-pii-egress.
process.env.OPEN_BRAIN_INGEST_URL = "https://open-brain.test/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token-enrichegress";
process.env.RESEND_API_KEY = "re_test_enrichegress";

import { runLeadEnrich } from "../src/lib/lead-enrich-run";

// THE enrichment egress invariants.
//
// This path reads a parent's email and writes what it learned onto a CRM row
// that also carries child fields. The CRM is already a sanctioned child-PII
// destination, so this adds no NEW destination — but it is a new WRITER, and
// the failure modes worth pinning are: fanning the parsed content out to
// Resend / Open Brain / analytics, overwriting a coach's own triage, and
// double-appending when the mail scan re-runs.
const PAGE = "page-enrich-target";
const PARENT = "parent@enrichegress.test";

// The fixture carries child data ON PURPOSE — the "must not forward"
// assertions only mean something if there is something to forward.
const CHILD = "Fabian";

function crmRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGE,
    properties: {
      "Player Name": { title: [{ plain_text: CHILD }] },
      "Parent Email": { email: PARENT },
      Age: { number: 11 },
      Notes: { rich_text: [{ plain_text: "Lead form submission. Child age: 11" }] },
      Level: { select: { name: "Eval Needed" } },
      Status: { select: { name: "Lead" } },
      ...overrides,
    },
  };
}

function installWorld(stub: FetchStub, rows: unknown[] = [crmRow()]) {
  stub
    .on("databases/enrich-egress-db/query", { results: rows, has_more: false })
    .on(/\/pages\//, { id: PAGE, properties: {} })
    .on("open-brain.test", { ok: true })
    .on("api.resend.com", { id: "email_test" })
    .install();
}

function input(extra: Record<string, unknown> = {}) {
  return {
    parentEmail: PARENT,
    summary: "Asked about privates before group; lives near Rockville.",
    ...extra,
  };
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

function patches() {
  return stub.calls.filter((c) => c.method === "PATCH");
}

test.describe("lead-enrich — egress", () => {
  test("reaches Notion and NOTHING else", async () => {
    installWorld(stub);
    await runLeadEnrich(input());

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      expect(
        new URL(call.url).host,
        `unexpected egress to ${call.url} — this path is Notion-only`,
      ).toBe("api.notion.com");
    }
  });

  test("never forwards to Open Brain or Resend even with both configured", async () => {
    installWorld(stub);
    await runLeadEnrich(input());

    expect(stub.callsTo("open-brain.test"), "no OB fan-out from enrichment").toHaveLength(0);
    expect(stub.callsTo("api.resend.com"), "enrichment sends no mail").toHaveLength(0);
  });

  test("never writes Status or Level", async () => {
    installWorld(stub);
    await runLeadEnrich(input());

    for (const call of patches()) {
      const props = JSON.parse(call.body).properties ?? {};
      expect(Object.keys(props)).not.toContain("Status");
      expect(Object.keys(props)).not.toContain("Level");
    }
  });

  test("a replayed messageId is a no-op, not a second append", async () => {
    installWorld(stub, [
      crmRow({
        Notes: {
          rich_text: [{ plain_text: "2026-08-29 · Email: earlier note [gm:abc123]" }],
        },
      }),
    ]);
    const res = await runLeadEnrich(input({ messageId: "abc123" }));

    expect(res.body.duplicate, "re-running the mail scan must not double-append").toBe(true);
    expect(patches(), "a duplicate must not PATCH at all").toHaveLength(0);
  });

  test("a NEW messageId does append", async () => {
    installWorld(stub, [
      crmRow({
        Notes: {
          rich_text: [{ plain_text: "2026-08-29 · Email: earlier note [gm:abc123]" }],
        },
      }),
    ]);
    await runLeadEnrich(input({ messageId: "different999" }));

    expect(patches()).toHaveLength(1);
    const notes = JSON.parse(patches()[0].body).properties.Notes.rich_text[0].text.content;
    expect(notes, "the earlier entry must survive").toContain("[gm:abc123]");
    expect(notes).toContain("[gm:different999]");
  });

  test("never overwrites a Location the coach already set", async () => {
    installWorld(stub, [crmRow({ Location: { select: { name: "Rockville" } } })]);
    await runLeadEnrich(input({ location: "Montgomery County" }));

    for (const call of patches()) {
      const props = JSON.parse(call.body).properties ?? {};
      expect(Object.keys(props)).not.toContain("Location");
    }
  });

  test("an unmatched parent creates nothing — the inbox cannot invent families", async () => {
    installWorld(stub, []);
    const res = await runLeadEnrich(input());

    expect(res.body.matched).toBe(false);
    expect(res.body.wrote).toBe(false);
    expect(
      stub.calls.filter((c) => c.method === "POST" && /\/v1\/pages$/.test(c.url)),
      "a stranger emailing us must not become a CRM row",
    ).toHaveLength(0);
  });

  test("a missing Landing Page property does not cost us the Notes append", async () => {
    // Notion 400s the WHOLE request when a payload names a property the DB
    // lacks — the failure that lost two real families. Landing Page is new.
    stub
      .on("databases/enrich-egress-db/query", { results: [crmRow()], has_more: false })
      .onDynamic(/\/pages\//, (call) =>
        call.body.includes("Landing Page")
          ? { status: 400, json: { message: "Landing Page is not a property that exists." } }
          : { status: 200, json: { id: PAGE } },
      )
      .install();

    const res = await runLeadEnrich(input({ landingPage: "https://nextgenpbacademy.com/x" }));

    expect(res.body.wrote, "the inquiry must still land in Notes").toBe(true);
    expect(res.body.droppedProps).toContain("Landing Page");
    const retried = JSON.parse(patches()[patches().length - 1].body).properties;
    expect(retried.Notes, "Notes is load-bearing and must survive the retry").toBeTruthy();
    expect(retried["Last Contact Date"]).toBeTruthy();
  });
});
