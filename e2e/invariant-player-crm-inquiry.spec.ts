import { test, expect } from "@playwright/test";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the libs — they read these at call time.
process.env.NOTION_API_KEY = "ntn_test_crminquiry";
process.env.NOTION_PLAYER_CRM_DB_ID = "crm-inquiry-db";

import { recordCrmInquiry, type CrmInquiry } from "../src/lib/player-crm-inquiry";
import {
  appendLeadInquiry,
  renderInquiryLine,
  type FamilyRow,
} from "../src/lib/notion-lead-enrich";
import { validateLeadEnrich, runLeadEnrich } from "../src/lib/lead-enrich-run";

// THE single-pipeline invariants (Sam, 2026-10-19).
//
// League interest, the waitlist, crew interest and Yellow Ball inquiries now
// land in the NGA Player CRM as leads, beside the form's own database. The
// failure modes worth pinning:
//   - a known family forked into a duplicate row (the CRM is keyed on the
//     parent, one row per child);
//   - a parent's self-reported colour sticking to a kid as Level;
//   - a child field beyond first name + age reaching the CRM;
//   - a replay doubling a Notes line;
//   - a missing column costing the whole row;
//   - the strict reply pair moving backwards, or on the wrong side.
//
// The Player CRM is already the sanctioned home for a child's first name and
// age (the lead form writes both on every submission), so this is a new WRITER
// into an existing destination, not a new destination.

const CRM_DB = "crm-inquiry-db";
const PARENT = "crm-inquiry@example.com";
const FORM_ROW = "3fefa3ac-27dc-81be-90e0-cf26571a093e";
const MARKER = "[sf:3fefa3ac27dc81be90e0cf26571a093e]";
const NOW = new Date("2026-10-19T15:00:00Z"); // 11:00 ET, Monday

/** Everything a new CRM row may carry. A new property is a deliberate edit
 * here, never a side effect of a form gaining a field. */
const ALLOWED_CREATE_PROPS = [
  "Player Name",
  "Parent Name",
  "Level",
  "Status",
  "Source",
  "Season",
  "Audience",
  "Notes",
  "Next Action",
  "Last Inbound Date",
  "Age",
  "Parent Email",
  "Parent Phone",
  "Location",
];

function crmRow(id: string, player: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    properties: {
      "Player Name": { title: [{ plain_text: player }] },
      "Parent Email": { email: PARENT },
      Age: { number: 10 },
      Notes: { rich_text: [{ plain_text: "2026-09-01 · Lead form: first touch" }] },
      Level: { select: { name: "Green" } },
      Status: { select: { name: "Active" } },
      ...extra,
    },
  };
}

function inquiry(over: Partial<CrmInquiry> = {}): CrmInquiry {
  return {
    source: "League Interest",
    parentName: "Crystal Example",
    email: PARENT,
    phone: "240-555-0134",
    kids: [{ firstName: "Malik", age: 10 }],
    summary: "10U league interest, age 10, parent-reported level Green",
    sourcePageId: FORM_ROW,
    ...over,
  };
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

/** The CRM query answers with `rows`; creates and patches succeed. */
function installCrm(rows: unknown[] = []) {
  stub
    .on(`databases/${CRM_DB}/query`, { results: rows, has_more: false })
    .onDynamic(/\/v1\/pages/, (call) =>
      call.method === "PATCH"
        ? { status: 200, json: { id: call.url.split("/").pop() } }
        : { status: 200, json: { id: "crm-row-created" } },
    )
    .install();
}

function creates(): RecordedFetch[] {
  return stub.calls.filter((c) => c.method === "POST" && /\/v1\/pages$/.test(c.url));
}
function patches(): RecordedFetch[] {
  return stub.calls.filter((c) => c.method === "PATCH");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function props(call: RecordedFetch): Record<string, any> {
  return JSON.parse(call.body).properties ?? {};
}

test.describe("recordCrmInquiry — a family the CRM has never seen", () => {
  test("creates one Lead row in the Player CRM, Source = the form", async () => {
    installCrm([]);
    const res = await recordCrmInquiry(inquiry(), { now: NOW });

    expect(res.status).toBe("created");
    expect(res.matchedFamily).toBe(false);
    expect(res.created).toBe(1);
    expect(creates()).toHaveLength(1);
    expect(JSON.parse(creates()[0].body).parent.database_id).toBe(CRM_DB);

    const p = props(creates()[0]);
    expect(p["Player Name"].title[0].text.content).toBe("Malik");
    expect(p.Status.select.name).toBe("Lead");
    expect(p.Source.select.name).toBe("League Interest");
    expect(p.Age.number).toBe(10);
    expect(p["Parent Email"].email).toBe(PARENT);
    expect(p["Last Inbound Date"].date.start).toBe("2026-10-19");
    expect(p.Season.select.name).toBe("Fall 2026");
  });

  test("the Notes origin line carries the form label and its replay marker", async () => {
    installCrm([]);
    await recordCrmInquiry(inquiry(), { now: NOW });

    const notes = props(creates()[0]).Notes.rich_text[0].text.content;
    expect(notes).toBe(
      `2026-10-19 · League Interest form: 10U league interest, age 10, parent-reported level Green ${MARKER}`,
    );
  });

  test("a parent-reported colour stays in Notes; Level is always Eval Needed", async () => {
    installCrm([]);
    await recordCrmInquiry(inquiry(), { now: NOW });

    const p = props(creates()[0]);
    expect(p.Level.select.name, "Level is coach judgment").toBe("Eval Needed");
    expect(Object.keys(p)).not.toContain("Child Level");
  });

  test("writes only the allowlisted properties: first name and age, never a birth year", async () => {
    installCrm([]);
    await recordCrmInquiry(
      inquiry({ location: "Montgomery County" }),
      { now: NOW },
    );

    const p = props(creates()[0]);
    for (const key of Object.keys(p)) {
      expect(ALLOWED_CREATE_PROPS, `unexpected CRM property "${key}"`).toContain(key);
    }
    expect(creates()[0].body.toLowerCase()).not.toContain("birth");
  });

  test("reaches Notion and nothing else", async () => {
    installCrm([]);
    await recordCrmInquiry(inquiry(), { now: NOW });

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      expect(new URL(call.url).host, `unexpected egress to ${call.url}`).toBe("api.notion.com");
    }
  });

  test("Location is written only when it is one of the lead-form locations", async () => {
    installCrm([]);
    await recordCrmInquiry(inquiry({ location: "Montgomery County" }), { now: NOW });
    expect(props(creates()[0]).Location.select.name).toBe("Montgomery County");

    stub.reset();
    installCrm([]);
    await recordCrmInquiry(inquiry({ location: "Bethesda" }), { now: NOW });
    expect(Object.keys(props(creates()[0])), "junk would auto-create a select option").not.toContain(
      "Location",
    );
  });

  test("an unnamed child still lands, titled for the parent", async () => {
    installCrm([]);
    const res = await recordCrmInquiry(inquiry({ kids: [] }), { now: NOW });

    expect(res.created).toBe(1);
    expect(props(creates()[0])["Player Name"].title[0].text.content).toBe(
      "Child of Crystal Example",
    );
  });

  test("a long summary is clipped so the Notes line stays well under the cap", async () => {
    installCrm([]);
    await recordCrmInquiry(inquiry({ summary: "x".repeat(2500) }), { now: NOW });

    const notes: string = props(creates()[0]).Notes.rich_text[0].text.content;
    expect(notes.length).toBeLessThan(700);
    expect(notes).toContain("…");
    expect(notes, "the marker must survive the clip").toContain(MARKER);
  });
});

test.describe("recordCrmInquiry — a family already in the CRM", () => {
  test("the same child (first-word match) gets one line, never a second row", async () => {
    installCrm([crmRow("row-malik", "Malik 10 yo")]);
    const res = await recordCrmInquiry(inquiry(), { now: NOW });

    expect(res.status).toBe("updated existing");
    expect(res.matchedFamily).toBe(true);
    expect(creates(), "a known child must not fork into a duplicate row").toHaveLength(0);
    expect(patches()).toHaveLength(1);
    expect(patches()[0].url).toContain("/pages/row-malik");

    const p = props(patches()[0]);
    const notes: string = p.Notes.rich_text[0].text.content;
    expect(notes.startsWith("2026-09-01 · Lead form: first touch"), "origin line kept").toBe(true);
    expect(notes).toContain(`League Interest form: 10U league interest`);
    expect(p["Last Inbound Date"].date.start).toBe("2026-10-19");
    expect(Object.keys(p)).not.toContain("Status");
    expect(Object.keys(p)).not.toContain("Level");
    expect(Object.keys(p)).not.toContain("Last Replied Date");
  });

  test("a new sibling gets its own row; the family's newest row gets the line", async () => {
    installCrm([crmRow("row-max", "Max")]);
    const res = await recordCrmInquiry(
      inquiry({ kids: [{ firstName: "Ava", age: 8 }] }),
      { now: NOW },
    );

    expect(res.status).toBe("updated existing + created 1 new child row(s)");
    expect(patches()).toHaveLength(1);
    expect(patches()[0].url).toContain("/pages/row-max");
    expect(creates()).toHaveLength(1);
    expect(props(creates()[0])["Player Name"].title[0].text.content).toBe("Ava");
  });

  test("of two named kids, only the one the family lacks is created", async () => {
    installCrm([crmRow("row-max", "Max")]);
    await recordCrmInquiry(
      inquiry({ kids: [{ firstName: "Max", age: 10 }, { firstName: "Ava", age: 8 }] }),
      { now: NOW },
    );

    expect(creates()).toHaveLength(1);
    expect(props(creates()[0])["Player Name"].title[0].text.content).toBe("Ava");
  });

  test("an unnamed child of a known family never forks it", async () => {
    installCrm([crmRow("row-max", "Max")]);
    const res = await recordCrmInquiry(inquiry({ kids: [{ firstName: "  " }] }), { now: NOW });

    expect(res.created).toBe(0);
    expect(creates()).toHaveLength(0);
    expect(patches()).toHaveLength(1);
  });

  test("replaying the same form row writes nothing", async () => {
    installCrm([
      crmRow("row-malik", "Malik", {
        Notes: {
          rich_text: [
            { plain_text: `2026-10-18 · League Interest form: 10U league interest ${MARKER}` },
          ],
        },
      }),
    ]);
    const res = await recordCrmInquiry(inquiry(), { now: NOW });

    expect(res.status).toBe("already recorded");
    expect(res.duplicate).toBe(true);
    expect(patches(), "a replay must not PATCH").toHaveLength(0);
    expect(creates(), "a replay must not create").toHaveLength(0);
  });

  test("a family found by phone alone is still one family", async () => {
    installCrm([
      crmRow("row-malik", "Malik", {
        "Parent Email": { email: null },
        "Parent Phone": { phone_number: "(240) 555-0134" },
      }),
    ]);
    const res = await recordCrmInquiry(inquiry({ email: null, phone: "+12405550134" }), {
      now: NOW,
    });

    expect(res.matchedFamily).toBe(true);
    expect(creates()).toHaveLength(0);
  });
});

test.describe("recordCrmInquiry — dry run, skips and failures", () => {
  test("dryRun reads the CRM and writes nothing", async () => {
    installCrm([]);
    const res = await recordCrmInquiry(inquiry(), { now: NOW, dryRun: true });

    expect(res.dryRun).toBe(true);
    expect(res.status).toBe("dry run: would create 1 row(s)");
    expect(stub.calls.length, "the dry run must still read").toBeGreaterThan(0);
    for (const call of stub.calls) {
      expect(call.url, `dry run wrote to ${call.url}`).toContain(`databases/${CRM_DB}/query`);
    }
  });

  test("dryRun against a known family reports the append it would make", async () => {
    installCrm([crmRow("row-malik", "Malik")]);
    const res = await recordCrmInquiry(inquiry(), { now: NOW, dryRun: true });

    expect(res.status).toBe("dry run: would append to the existing family");
    expect(patches()).toHaveLength(0);
    expect(creates()).toHaveLength(0);
  });

  test("no Notion key: zero calls, and it says why", async () => {
    installCrm([]);
    const saved = process.env.NOTION_API_KEY;
    delete process.env.NOTION_API_KEY;
    try {
      const res = await recordCrmInquiry(inquiry(), { now: NOW });
      expect(res.status).toBe("skipped (NOTION_API_KEY missing)");
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_API_KEY = saved;
    }
  });

  test("no email and no phone: zero calls, nothing to key a family on", async () => {
    installCrm([]);
    const res = await recordCrmInquiry(inquiry({ email: " ", phone: null }), { now: NOW });

    expect(res.status).toBe("skipped (no parent email or phone)");
    expect(stub.calls).toHaveLength(0);
  });

  test("a CRM without the Last Inbound Date column still gets the row", async () => {
    let attempt = 0;
    stub
      .on(`databases/${CRM_DB}/query`, { results: [] })
      .onDynamic(/\/v1\/pages$/, () => {
        attempt += 1;
        return attempt === 1
          ? {
              status: 400,
              json: {
                object: "error",
                message: "Last Inbound Date is not a property that exists.",
              },
            }
          : { status: 200, json: { id: "crm-row-created" } };
      })
      .install();

    const res = await recordCrmInquiry(inquiry(), { now: NOW });

    expect(res.status).toBe("created");
    expect(creates()).toHaveLength(2);
    expect(Object.keys(props(creates()[1]))).not.toContain("Last Inbound Date");
    expect(props(creates()[1]).Notes, "the line is the point; it must survive").toBeTruthy();
  });

  test("a rejection naming a required property is not retried and is reported", async () => {
    stub
      .on(`databases/${CRM_DB}/query`, { results: [] })
      .on(
        /\/v1\/pages$/,
        { object: "error", message: "Parent Name is expected to be rich_text." },
        400,
      )
      .install();

    const res = await recordCrmInquiry(inquiry(), { now: NOW });

    expect(creates()).toHaveLength(1);
    expect(res.created).toBe(0);
    expect(res.status).toContain("failed");
  });

  test("a network failure resolves with an error status; it never throws", async () => {
    // Only the query is stubbed, so the create throws inside fetch.
    stub.on(`databases/${CRM_DB}/query`, { results: [] }).install();

    const res = await recordCrmInquiry(inquiry(), { now: NOW });
    expect(res.status.startsWith("error (")).toBe(true);
    expect(res.created).toBe(0);
  });
});

// The strict reply pair (2026-10-19). Last Contact Date moves on anything, so
// it cannot say whether a family is waiting on Sam. Last Inbound Date moves
// only on the family writing to us; Last Replied Date only on a real reply.
// Both move forward-only. The nudge reads them to tell who owes whom a reply.
function familyRow(over: Partial<FamilyRow> = {}): FamilyRow {
  return {
    id: "row-pair",
    playerName: "Max",
    notes: "2026-09-01 · Lead form: first touch",
    location: "",
    landingPage: "",
    parentEmail: PARENT,
    parentPhone: "",
    lastContactDate: "2026-10-10",
    lastInboundDate: "2026-10-10",
    lastRepliedDate: "2026-10-12",
    ...over,
  };
}

function installPatchOnly() {
  stub.on(/\/v1\/pages\//, { id: "row-pair" }).install();
}

test.describe("appendLeadInquiry — the strict reply pair", () => {
  test("an inbound entry stamps Last Inbound Date and never Last Replied Date", async () => {
    installPatchOnly();
    const res = await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-18", channel: "Email", summary: "Asked about 10U", direction: "inbound" },
      familyRow(),
    );

    expect(res.updated).toBe(true);
    const p = props(patches()[0]);
    expect(p["Last Inbound Date"].date.start).toBe("2026-10-18");
    expect(Object.keys(p)).not.toContain("Last Replied Date");
  });

  test("an outbound entry stamps Last Replied Date, never Last Inbound Date, and reads as sent", async () => {
    installPatchOnly();
    const res = await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-18", channel: "Email", summary: "Sent the 10U dates", direction: "outbound" },
      familyRow(),
    );

    const p = props(patches()[0]);
    expect(p["Last Replied Date"].date.start).toBe("2026-10-18");
    expect(Object.keys(p)).not.toContain("Last Inbound Date");
    expect(res.line).toBe("2026-10-18 · Email (sent): Sent the 10U dates");
  });

  test("neither date moves backwards", async () => {
    installPatchOnly();
    await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-05", channel: "Email", summary: "Late straggler", direction: "inbound" },
      familyRow(),
    );
    await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-05", channel: "Email", summary: "Late straggler", direction: "outbound" },
      familyRow(),
    );

    for (const call of patches()) {
      const keys = Object.keys(props(call));
      expect(keys).not.toContain("Last Inbound Date");
      expect(keys).not.toContain("Last Replied Date");
      expect(keys, "the line itself still lands").toContain("Notes");
    }
  });

  test("an entry with no direction (a note, a meeting) stamps neither", async () => {
    installPatchOnly();
    await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-18", channel: "Note", summary: "Coach note" },
      familyRow(),
    );

    const keys = Object.keys(props(patches()[0]));
    expect(keys).not.toContain("Last Inbound Date");
    expect(keys).not.toContain("Last Replied Date");
    expect(keys, "Last Contact Date keeps its loose meaning").toContain("Last Contact Date");
  });

  test("a blank pair is filled by the first entry on each side", async () => {
    installPatchOnly();
    const empty = familyRow({ lastInboundDate: "", lastRepliedDate: "" });
    await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-18", channel: "Email", summary: "First reply", direction: "outbound" },
      empty,
    );

    expect(props(patches()[0])["Last Replied Date"].date.start).toBe("2026-10-18");
  });

  test("a CRM without the Last Replied Date column still gets the Notes line", async () => {
    let attempt = 0;
    stub
      .onDynamic(/\/v1\/pages\//, () => {
        attempt += 1;
        return attempt === 1
          ? {
              status: 400,
              json: { object: "error", message: "Last Replied Date is not a property that exists." },
            }
          : { status: 200, json: { id: "row-pair" } };
      })
      .install();

    const res = await appendLeadInquiry(
      "row-pair",
      { date: "2026-10-18", channel: "Email", summary: "Sent dates", direction: "outbound" },
      familyRow(),
    );

    expect(res.updated).toBe(true);
    expect(res.droppedProps).toEqual(["Last Replied Date"]);
    expect(Object.keys(props(patches()[1]))).toContain("Notes");
  });

  test("renderInquiryLine labels only outbound lines", () => {
    const base = { date: "2026-10-18", channel: "Email", summary: "Hi" };
    expect(renderInquiryLine({ ...base, direction: "inbound" })).toBe("2026-10-18 · Email: Hi");
    expect(renderInquiryLine(base)).toBe("2026-10-18 · Email: Hi");
    expect(renderInquiryLine({ ...base, direction: "outbound" })).toBe(
      "2026-10-18 · Email (sent): Hi",
    );
  });
});

test.describe("/api/lead-enrich — direction is a closed vocabulary", () => {
  test("only inbound and outbound pass validation", () => {
    const base = { parentEmail: PARENT, summary: "x" };
    expect(validateLeadEnrich({ ...base, direction: "inbound" })).toEqual([]);
    expect(validateLeadEnrich({ ...base, direction: "outbound" })).toEqual([]);
    expect(validateLeadEnrich(base)).toEqual([]);
    expect(validateLeadEnrich({ ...base, direction: "sideways" })).toContain(
      "direction must be inbound or outbound",
    );
  });

  test("site_form is internal: an external caller cannot claim it", () => {
    expect(
      validateLeadEnrich({ parentEmail: PARENT, summary: "x", messageSource: "site_form" }),
    ).toContain("messageSource must be gmail, imessage or open_brain");
  });

  test("an outbound push from Open Brain stamps Last Replied Date on the row", async () => {
    stub
      .on(`databases/${CRM_DB}/query`, {
        results: [
          crmRow("row-malik", "Malik", {
            "Last Inbound Date": { date: { start: "2026-10-15" } },
          }),
        ],
      })
      .on(/\/v1\/pages\//, { id: "row-malik" })
      .install();

    const res = await runLeadEnrich({
      parentEmail: PARENT,
      summary: "Sent the fall dates",
      messageId: "18f2c0a1b2",
      messageSource: "gmail",
      channel: "Email",
      direction: "outbound",
      observedAt: "2026-10-16",
    });

    expect(res.status).toBe(200);
    const p = props(patches()[0]);
    expect(p["Last Replied Date"].date.start).toBe("2026-10-16");
    expect(Object.keys(p)).not.toContain("Last Inbound Date");
    expect(p.Notes.rich_text[0].text.content).toContain(
      "2026-10-16 · Email (sent): Sent the fall dates [gm:18f2c0a1b2]",
    );
  });
});
