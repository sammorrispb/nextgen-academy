import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";
process.env.NOTION_SESSIONS_DB_ID = "db-sessions-test";
process.env.RESEND_API_KEY = "re_test_dummy";
process.env.NEXT_PUBLIC_SITE_URL = "https://nextgenpbacademy.com";

import {
  planRescheduleRoster,
  executeSessionReschedule,
  type RowPlan,
} from "../src/lib/session-reschedule";
import { isSeederManagedRow } from "../src/lib/recurring-sessions";
import { RECURRING_TEMPLATES } from "../src/data/recurring-templates";
import {
  sessionRescheduledHtml,
  sessionRescheduledText,
} from "../src/lib/email/session-rescheduled";

const SESSION_ROW_ID = "11111111-1111-1111-1111-111111111111";

// The weeknight templates were retired to `active: false` in the 2026-07-21
// weekend move, so NO live template is active and the F5 seeder-managed guard
// is dormant. The guard LOGIC is unchanged and still fires the moment a
// template is active again, so the pure tests below inject an active-weeknight
// fixture to keep pinning it (title + level + weekday + active must ALL match).
const WEEKNIGHT_FIXTURE = RECURRING_TEMPLATES.filter(
  (t) => t.weekday >= 1 && t.weekday <= 4,
).map((t) => ({ ...t, active: true }));

// ── Notion drop-in page factory (shape pageToDropIn reads) ──
function dropInPage(opts: {
  id: string;
  date?: string;
  start?: string;
  rescheduleNotified?: boolean;
  email?: string;
}) {
  return {
    id: opts.id,
    url: `https://www.notion.so/${opts.id}`,
    properties: {
      "Parent Name": { rich_text: [{ plain_text: "Dana Parent" }] },
      "Parent Email": { email: opts.email ?? "dana@example.com" },
      "Child First Name": { rich_text: [{ plain_text: "Sky" }] },
      "Session Title": { rich_text: [{ plain_text: "Green Saturday" }] },
      "Session Date": { date: { start: opts.date ?? "2026-06-20" } },
      "Session Start Time": { rich_text: [{ plain_text: opts.start ?? "6:00 PM" }] },
      "Session Row ID": { rich_text: [{ plain_text: SESSION_ROW_ID }] },
      Status: { select: { name: "Confirmed" } },
      "Reschedule Notified": { checkbox: opts.rescheduleNotified ?? false },
    },
  };
}

function queryResult(pages: unknown[]) {
  return { results: pages, has_more: false, next_cursor: null };
}

const baseInput = {
  sessionRowId: SESSION_ROW_ID,
  sessionTitle: "Green Saturday",
  oldDate: "2026-06-20",
  oldStartTime: "6:00 PM",
  newDate: "2030-06-27",
  newStartTime: "6:00 PM",
  newEndTime: "7:00 PM",
};

// ───────────────────────── Pure: planner ─────────────────────────
test.describe("planRescheduleRoster (pure)", () => {
  const target = { newDate: "2030-06-27", newStartTime: "6:00 PM" };

  test("row at old date → needs migration AND notify", () => {
    const [p] = planRescheduleRoster(
      [{ id: "r1", sessionDate: "2026-06-20", sessionStartTime: "6:00 PM", rescheduleNotified: false }],
      target,
    );
    expect(p.needsMigration).toBe(true);
    expect(p.needsNotify).toBe(true);
    expect(p.newSessionDate).toBe("2030-06-27");
    expect(p.newSessionStartTime).toBe("6:00 PM");
  });

  test("row already at target date+time + flagged → no migration, no notify (idempotent)", () => {
    const [p] = planRescheduleRoster(
      [{ id: "r1", sessionDate: "2030-06-27", sessionStartTime: "6:00 PM", rescheduleNotified: true }],
      target,
    );
    expect(p.needsMigration).toBe(false);
    expect(p.needsNotify).toBe(false);
  });

  test("moved but not yet notified → migrate skipped, notify still due (partial recovery)", () => {
    const [p] = planRescheduleRoster(
      [{ id: "r1", sessionDate: "2030-06-27", sessionStartTime: "6:00 PM", rescheduleNotified: false }],
      target,
    );
    expect(p.needsMigration).toBe(false);
    expect(p.needsNotify).toBe(true);
  });

  test("time change alone triggers migration", () => {
    const [p] = planRescheduleRoster(
      [{ id: "r1", sessionDate: "2030-06-27", sessionStartTime: "5:00 PM", rescheduleNotified: true }],
      target,
    );
    expect(p.needsMigration).toBe(true);
  });
});

test.describe("isSeederManagedRow (pure, F5) — title+level+weekday must ALL match an active template", () => {
  // 2026-07-06 Mon · 07-07 Tue · 07-08 Wed · 07-09 Thu · 07-11 Sat
  test("rows the seeder actually manages are blocked (incl. legacy Olney prefix)", () => {
    expect(isSeederManagedRow({ title: "Redland Tuesday Evening — Red", date: "2026-07-07" }, WEEKNIGHT_FIXTURE)).toBe(true);
    expect(isSeederManagedRow({ title: "Olney Tuesday Evening — Yellow", date: "2026-07-07" }, WEEKNIGHT_FIXTURE)).toBe(true);
    expect(isSeederManagedRow({ title: "Ridgeview Monday Evening — Green", date: "2026-07-06" }, WEEKNIGHT_FIXTURE)).toBe(true);
    expect(isSeederManagedRow({ title: "Westland Wednesday Evening — Red", date: "2026-07-08" }, WEEKNIGHT_FIXTURE)).toBe(true);
    expect(isSeederManagedRow({ title: "Shannon Thursday Evening — Yellow", date: "2026-07-09" }, WEEKNIGHT_FIXTURE)).toBe(true);
  });

  test("weekday mismatch → NOT managed (hand-moved row reschedules normally)", () => {
    // A Tuesday-titled row sitting on a Saturday: the seeder will never touch
    // that date, so blocking its reschedule was pure friction.
    expect(isSeederManagedRow({ title: "Redland Tuesday Evening — Red", date: "2026-07-11" }, WEEKNIGHT_FIXTURE)).toBe(false);
    expect(isSeederManagedRow({ title: "Ridgeview Monday Evening — Green", date: "2026-07-07" }, WEEKNIGHT_FIXTURE)).toBe(false);
  });

  test("level outside the template's levels → NOT managed (Shannon seeds Green/Yellow only)", () => {
    expect(
      isSeederManagedRow({ title: "Shannon Thursday Evening — Red", date: "2026-07-09", level: "Red" }, WEEKNIGHT_FIXTURE),
    ).toBe(false);
    expect(
      isSeederManagedRow({ title: "Shannon Thursday Evening — Green", date: "2026-07-09", level: "Green" }, WEEKNIGHT_FIXTURE),
    ).toBe(true);
  });

  test("explicit level wins over the title suffix", () => {
    // Row hand-retitled but its Level select says Red — Shannon doesn't seed Red.
    expect(
      isSeederManagedRow({ title: "Shannon Thursday Evening — Green", date: "2026-07-09", level: "Red" }, WEEKNIGHT_FIXTURE),
    ).toBe(false);
  });

  test("an INACTIVE template's rows are not managed", () => {
    const oneInactive = WEEKNIGHT_FIXTURE.map((t) =>
      t.titleBase === "Redland Tuesday Evening" ? { ...t, active: false } : t,
    );
    expect(
      isSeederManagedRow({ title: "Redland Tuesday Evening — Red", date: "2026-07-07" }, oneInactive),
    ).toBe(false);
  });

  test("with all live templates retired (inactive), nothing is seeder-managed", () => {
    // Default templates arg = the live RECURRING_TEMPLATES, all inactive now.
    expect(isSeederManagedRow({ title: "Redland Tuesday Evening — Red", date: "2026-07-07" })).toBe(false);
    expect(isSeederManagedRow({ title: "Wood Saturday Evening — Red", date: "2026-08-01" })).toBe(false);
  });

  test("non-recurring titles / bad dates are never managed", () => {
    expect(isSeederManagedRow({ title: "Green Saturday", date: "2026-07-11" }, WEEKNIGHT_FIXTURE)).toBe(false);
    expect(isSeederManagedRow({ title: "", date: "2026-07-07" }, WEEKNIGHT_FIXTURE)).toBe(false);
    expect(isSeederManagedRow({ title: "Redland Tuesday Evening — Red", date: "" }, WEEKNIGHT_FIXTURE)).toBe(false);
    expect(isSeederManagedRow({ title: "Redland Tuesday Evening — Red", date: "not-a-date" }, WEEKNIGHT_FIXTURE)).toBe(false);
  });
});

// ───────────────────────── Pure: template ─────────────────────────
test.describe("session-rescheduled template (pure)", () => {
  const args = {
    parentFirst: "Dana",
    childFirst: "Sky",
    sessionTitle: "Green Saturday",
    oldDateLong: "Saturday, June 20, 2026",
    oldStart: "6:00 PM",
    newDateLong: "Saturday, June 27, 2026",
    newStart: "6:00 PM",
    scheduleUrl: "https://nextgenpbacademy.com/schedule",
  };

  test("HTML + text show the NEW date and the old→new transition", () => {
    const html = sessionRescheduledHtml(args);
    const text = sessionRescheduledText(args);
    for (const body of [html, text]) {
      expect(body).toContain("June 27, 2026"); // new
      expect(body).toContain("June 20, 2026"); // was
      expect(body).toContain("Coach Sam");
    }
    expect(html).toContain("Reschedule"); // eyebrow
  });

  test("interpolated names are HTML-escaped in the HTML body", () => {
    const html = sessionRescheduledHtml({ ...args, childFirst: "<script>x</script>" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ───────────────── Integration: executeSessionReschedule ─────────────────
test.describe("executeSessionReschedule (integration, offline)", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
  });
  test.afterEach(() => stub.uninstall());

  test("NEVER contacts Stripe (refund-free), happy path moves + emails all", async () => {
    stub
      .on("/databases/", queryResult([dropInPage({ id: "row-1" }), dropInPage({ id: "row-2" })]))
      .on("api.resend.com", { id: "email_test" })
      .on("/pages/", { id: "x", properties: {} });

    const res = await executeSessionReschedule(baseInput);

    expect(res.ok).toBe(true);
    expect(res.rosterSize).toBe(2);
    expect(res.migrated).toBe(2);
    expect(res.emailed).toBe(2);
    expect(stub.callsTo("api.stripe.com").length).toBe(0);
    // session row advanced (Phase 3)
    expect(stub.callsTo(SESSION_ROW_ID).length).toBe(1);
    // both roster rows re-dated
    expect(stub.callsTo("/pages/row-1").length).toBeGreaterThan(0);
    expect(stub.callsTo("/pages/row-2").length).toBeGreaterThan(0);
  });

  test("empty roster → updates session row only, no comms", async () => {
    stub
      .on("/databases/", queryResult([]))
      .on("/pages/", { id: "x", properties: {} });

    const res = await executeSessionReschedule(baseInput);
    expect(res.ok).toBe(true);
    expect(res.rosterSize).toBe(0);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
    expect(stub.callsTo(SESSION_ROW_ID).length).toBe(1);
  });

  test("partial migration failure → aborts before emailing, session row NOT advanced", async () => {
    stub
      .on("/databases/", queryResult([dropInPage({ id: "row-1" }), dropInPage({ id: "row-2" })]))
      .on("/pages/row-2", {}, 500) // one row fails to move
      .on("api.resend.com", { id: "email_test" })
      .on("/pages/", { id: "x", properties: {} });

    const res = await executeSessionReschedule(baseInput);
    expect(res.ok).toBe(false);
    expect(res.errors).toBe(1);
    expect(stub.callsTo("api.resend.com").length).toBe(0); // nobody emailed
    expect(stub.callsTo(SESSION_ROW_ID).length).toBe(0); // date not changed
  });

  test("idempotent: rows already moved + flagged → emails nobody", async () => {
    stub
      .on(
        "/databases/",
        queryResult([
          dropInPage({ id: "row-1", date: "2030-06-27", rescheduleNotified: true }),
          dropInPage({ id: "row-2", date: "2030-06-27", rescheduleNotified: true }),
        ]),
      )
      .on("/pages/", { id: "x", properties: {} });

    const res = await executeSessionReschedule(baseInput);
    expect(res.ok).toBe(true);
    expect(res.migrated).toBe(0);
    expect(res.emailed).toBe(0);
    expect(stub.callsTo("api.resend.com").length).toBe(0);
  });

  test("a retired weeknight row reschedules normally now its template is inactive (guard dormant)", async () => {
    // Pre-weekend-move this was blocked as seeder-managed. With the Tuesday
    // template retired to inactive, the seeder will never re-create the row, so
    // the F5 guard correctly no longer blocks it — it reschedules like any row.
    stub
      .on("/databases/", queryResult([]))
      .on("/pages/", { id: "x", properties: {} });
    const res = await executeSessionReschedule({
      ...baseInput,
      sessionTitle: "Redland Tuesday Evening — Red",
      oldDate: "2026-06-16", // a Tuesday — but the template is inactive now
    });
    expect(res.ok).toBe(true);
    expect(stub.callsTo(SESSION_ROW_ID).length).toBe(1); // session row advanced
  });

  test("a template-titled row on a NON-template weekday reschedules normally (F5 scope-narrowing)", async () => {
    stub
      .on("/databases/", queryResult([]))
      .on("/pages/", { id: "x", properties: {} });
    const res = await executeSessionReschedule({
      ...baseInput,
      sessionTitle: "Redland Tuesday Evening — Red",
      oldDate: "2026-06-20", // a Saturday — hand-moved off the seeded slot
    });
    expect(res.ok).toBe(true);
    expect(stub.callsTo(SESSION_ROW_ID).length).toBe(1); // session row advanced
  });

  test("a Shannon-titled row at a level Shannon doesn't seed reschedules normally", async () => {
    stub
      .on("/databases/", queryResult([]))
      .on("/pages/", { id: "x", properties: {} });
    const res = await executeSessionReschedule({
      ...baseInput,
      sessionTitle: "Shannon Thursday Evening — Red", // Shannon seeds Green/Yellow only
      oldDate: "2026-07-09", // a Thursday
    });
    expect(res.ok).toBe(true);
    expect(stub.callsTo(SESSION_ROW_ID).length).toBe(1);
  });

  test("rejects a past target date before any network call", async () => {
    const res = await executeSessionReschedule({ ...baseInput, newDate: "2020-01-01" });
    expect(res.ok).toBe(false);
    expect(stub.calls.length).toBe(0);
  });

  test("rejects a malformed target date before any network call", async () => {
    const res = await executeSessionReschedule({ ...baseInput, newDate: "2030/13/40" });
    expect(res.ok).toBe(false);
    expect(stub.calls.length).toBe(0);
  });
});

// keep the RowPlan type referenced (compile guard)
const _typecheck: RowPlan | null = null;
void _typecheck;
