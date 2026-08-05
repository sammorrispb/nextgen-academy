/**
 * INVARIANT: the "From Coach Sam" lead block can never go missing silently.
 *
 * The incident this pins (2026-08-05): an Approved Newsletter Drafts row
 * carrying the Aug 17-20 camp shipped once on 2026-07-23, then fell one day
 * outside the 7-day `Drafted At` window and stopped appearing in every issue
 * after it — while still reading `Status = Approved`. No error, no log, no
 * alert. `fetchApprovedNewsletterDrafts` collapsed five distinct outcomes into
 * one bare array, so the cron could not tell "Sam approved nothing" apart from
 * "Notion is down", "the body was unreadable", or "a live announcement aged
 * out". Every one of those reported `ok: true`.
 *
 * Two halves are pinned here:
 *  1. SYSTEM failures (query error / unreadable body / unconfigured DB) now
 *     carry their own signatures, so `ok: true` stops lying.
 *  2. The STRANDED detector — an Approved row whose operator set a live
 *     `Expires At` that the freshness window is now suppressing. The predicate
 *     MUST stay silent on the ordinary Approved archive (rows stay Approved
 *     forever after shipping; there were 8 such rows in prod on 2026-08-05), or
 *     the alert becomes weekly noise and gets filtered away.
 *
 * Nothing here may weaken the approval gate: the cron reports, it never writes
 * Status. And no PII may ride an alert body — refs are Notion page IDs only.
 */
import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the route.
process.env.CRON_SECRET = "test-cron-secret";
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.NOTION_NEWSLETTER_DB_ID = "subs-db";
process.env.NOTION_NEWS_DB_ID = "news-db";
process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = "drafts-db";
process.env.RESEND_API_KEY = "re_test";
process.env.NGA_ADMIN_SECRET = "admin-secret";
// Polls are optional; leaving the DB unset keeps the poll fetch off the wire.
delete process.env.NOTION_CREW_POLLS_DB_ID;
delete process.env.NOTION_POLL_RESPONSES_DB_ID;

import { GET } from "../src/app/api/cron/weekly-newsletter/route";

const DRAFTS_DB = /databases\/drafts-db\/query/;
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];

// A parent on the list. Neither this address nor the child's name may ever
// appear in an alert body.
const PARENT_EMAIL = "parent@example.com";
const PARENT_NAME = "Dana Whitfield";
// Free-text operator title — the exact field that could carry a family name,
// which is why the alert refs are page IDs and never the `Week` title.
const DRAFT_TITLE = "Weekend move + back-to-school camp (Aug 2026)";

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/cron/weekly-newsletter", {
    method: "GET",
    headers,
  });
}

/** A Notion row shaped the way the drafts DB returns one. */
function draftRow(id: string, title = DRAFT_TITLE) {
  return {
    id,
    properties: {
      Week: { title: [{ plain_text: title }] },
      "Source Radar": { url: "" },
      "Section Count": { number: 1 },
    },
  };
}

function bodyBlocks(text: string) {
  return {
    results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: text }] } }],
  };
}

const stub = new FetchStub();

/**
 * Wire every dependency the cron touches. `drafts` answers the in-window
 * Approved query; `stranded` answers the stranded-detector query (told apart
 * by the `is_not_empty` Expires At leg only that filter carries); `blocks`
 * maps page id -> child-blocks response, and a null value models an
 * unreadable body (Notion 500 on the blocks fetch).
 */
function wire(opts: {
  drafts?: unknown[];
  stranded?: unknown[];
  blocks?: Record<string, unknown | null>;
  draftsQueryStatus?: number;
} = {}) {
  const { drafts = [], stranded = [], blocks = {}, draftsQueryStatus = 200 } = opts;

  stub.onDynamic(DRAFTS_DB, (call: RecordedFetch) => {
    const isStrandedQuery = call.body.includes("is_not_empty");
    if (!isStrandedQuery && draftsQueryStatus !== 200) {
      return { status: draftsQueryStatus, json: { message: "notion is down" } };
    }
    return { status: 200, json: { results: isStrandedQuery ? stranded : drafts } };
  });

  stub.onDynamic(/blocks\/([^/]+)\/children/, (call: RecordedFetch) => {
    const id = /blocks\/([^/]+)\/children/.exec(call.url)?.[1] ?? "";
    const entry = blocks[id];
    if (entry === null || entry === undefined) {
      return { status: 500, json: { message: "blocks unavailable" } };
    }
    return { status: 200, json: entry };
  });

  // No open sessions and no news → a tip-only issue. Keeps the fixture small
  // and (with zero sessions) keeps the weather API off the wire entirely.
  stub.on(/databases\/sessions-db\/query/, { results: [] });
  stub.on(/databases\/news-db\/query/, { results: [] });
  stub.on(/databases\/subs-db\/query/, {
    results: [
      {
        id: "sub-1",
        properties: {
          "Parent Name": { title: [{ plain_text: PARENT_NAME }] },
          Email: { email: PARENT_EMAIL },
        },
      },
    ],
  });
  stub.on("api.resend.com", { id: "email-1" });
  // Any other Notion write (e.g. the Sent At stamp) succeeds quietly.
  stub.on("api.notion.com", { ok: true });
}

/** Every Resend body that is a cron alert rather than a newsletter. */
function alertBodies(): string[] {
  return stub
    .callsTo("api.resend.com")
    .map((c) => c.body)
    .filter((b) => b.includes("[cron-alert]"));
}

test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("Bearer gate fails closed", () => {
  test("no Authorization → 401 and zero downstream calls", async () => {
    wire();
    const res = await GET(req(undefined));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });

  test("wrong secret → 401 and zero downstream calls", async () => {
    wire();
    const res = await GET(req("not-the-secret"));
    expect(res.status).toBe(401);
    expect(stub.calls.length).toBe(0);
  });
});

test.describe("system failures stop reporting ok:true", () => {
  test("a Notion drafts-query error surfaces its own signature and still ships the issue", async () => {
    wire({ draftsQueryStatus: 500 });

    const res = await GET(req("test-cron-secret"));

    // The lead block is gone, but the newsletter itself still went out.
    const sends = stub
      .callsTo("api.resend.com")
      .filter((c) => !c.body.includes("[cron-alert]"));
    expect(sends.length, "subscriber send + admin QA copy").toBe(2);
    expect(sends[0].body).toContain(PARENT_EMAIL);

    expect(res.status).toBe(500);
    const alerts = alertBodies();
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("newsletter_drafts_query_failed");
  });

  test("an unreadable body is reported, and the readable rows still ship", async () => {
    wire({
      drafts: [draftRow("draft-ok"), draftRow("draft-broken"), draftRow("draft-ok-2")],
      blocks: {
        "draft-ok": bodyBlocks("First approved section."),
        "draft-broken": null, // blocks fetch fails → row silently dropped today
        "draft-ok-2": bodyBlocks("Third approved section."),
      },
    });

    const res = await GET(req("test-cron-secret"));

    const sends = stub
      .callsTo("api.resend.com")
      .filter((c) => !c.body.includes("[cron-alert]"));
    expect(sends[0].body).toContain("First approved section.");
    expect(sends[0].body).toContain("Third approved section.");

    expect(res.status).toBe(500);
    const alerts = alertBodies();
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("newsletter_draft_unreadable");
    // The dropped row is named by page id so Sam can go straight to it.
    expect(alerts[0]).toContain("draft-broken");
  });

  test("an unset drafts DB is a misconfiguration, not a quiet no-op", async () => {
    const saved = process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
    delete process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID;
    try {
      wire();
      const res = await GET(req("test-cron-secret"));
      expect(res.status).toBe(500);
      expect(alertBodies()[0]).toContain("config_missing");
    } finally {
      process.env.NOTION_NEWSLETTER_DRAFTS_DB_ID = saved;
    }
  });
});

test.describe("the stranded detector", () => {
  test("ARCHIVE STAYS QUIET: ordinary Approved rows with no Expires At never alert", async () => {
    // Models the real prod state on 2026-08-05: rows stay Approved forever
    // after shipping, so a predicate without the Expires At leg would flag all
    // of them every single Thursday. This is THE regression to prevent.
    wire({
      drafts: [draftRow("draft-this-week")],
      blocks: { "draft-this-week": bodyBlocks("This week's section.") },
      stranded: [], // no row declared a live shelf-life
    });

    const res = await GET(req("test-cron-secret"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(alertBodies().length, "a healthy week alerts about nothing").toBe(0);
  });

  test("a live Expires At row suppressed by the freshness window IS flagged", async () => {
    wire({
      drafts: [],
      stranded: [draftRow("stranded-camp-row")],
    });

    const res = await GET(req("test-cron-secret"));

    expect(res.status).toBe(500);
    const alert = alertBodies()[0];
    expect(alert).toContain("approved_draft_did_not_ship");
    expect(alert).toContain("stranded-camp-row");
  });

  test("the detector query asks Notion for a LIVE Expires At outside the window", async () => {
    wire({ drafts: [], stranded: [] });
    await GET(req("test-cron-secret"));

    const strandedQuery = stub
      .callsTo(DRAFTS_DB)
      .find((c) => c.body.includes("is_not_empty"));
    expect(strandedQuery, "the stranded detector runs its own query").toBeTruthy();
    const filter = JSON.parse(strandedQuery!.body).filter;
    const legs = JSON.stringify(filter);
    // Approved + drafted BEFORE the cutoff + an Expires At that is set and
    // has not passed. Drop any leg and the archive floods the alert.
    expect(legs).toContain("Approved");
    expect(legs).toContain("before");
    expect(legs).toContain("is_not_empty");
    expect(legs).toContain("on_or_after");
  });
});

test.describe("alert hygiene", () => {
  test("the alert says the newsletter WAS sent — this cron is not idempotent", async () => {
    // A red dashboard on a run whose emails already went out invites a re-run,
    // and a re-run re-sends the whole issue to every Active subscriber.
    wire({ drafts: [], stranded: [draftRow("stranded-1")] });
    await GET(req("test-cron-secret"));

    const alert = alertBodies()[0];
    expect(alert).toContain("WAS sent");
    expect(alert.toLowerCase()).toContain("do not re-run");
  });

  test("no parent email, parent name, or free-text row title rides an alert", async () => {
    wire({
      drafts: [draftRow("draft-broken")],
      blocks: { "draft-broken": null },
      stranded: [draftRow("stranded-1")],
    });
    await GET(req("test-cron-secret"));

    const alert = alertBodies()[0];
    expect(alert).not.toContain(PARENT_EMAIL);
    expect(alert).not.toContain(PARENT_NAME);
    expect(alert).not.toContain(DRAFT_TITLE);
  });

  test("everything egresses to Notion and Resend only", async () => {
    wire({
      drafts: [draftRow("draft-ok")],
      blocks: { "draft-ok": bodyBlocks("Section.") },
      stranded: [draftRow("stranded-1")],
    });
    await GET(req("test-cron-secret"));

    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
  });
});

test.describe("the approval gate does not move", () => {
  test("the cron never writes a draft Status", async () => {
    wire({
      drafts: [draftRow("draft-ok")],
      blocks: { "draft-ok": bodyBlocks("Section.") },
      stranded: [draftRow("stranded-1")],
    });
    await GET(req("test-cron-secret"));

    // Reporting a stranded row must never "helpfully" retire or re-date it.
    const writes = stub.calls.filter(
      (c) => c.method === "PATCH" && c.url.includes("api.notion.com/v1/pages/"),
    );
    for (const w of writes) {
      expect(w.body, "the only draft write is the Sent At stamp").not.toContain(
        '"Status"',
      );
      expect(w.body).not.toContain('"Drafted At"');
    }
  });
});
