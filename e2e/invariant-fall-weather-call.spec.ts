import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE the modules read it (all reads are lazy / at call time).
process.env.NOTION_API_KEY = "ntn_test_fallcalls";
process.env.NOTION_FALL_CALLS_DB_ID = "fall-calls-db";
process.env.NOTION_FALL_REGS_DB_ID = "fall-calls-regs-db";
process.env.RESEND_API_KEY = "re_test_fallcalls";
process.env.SESSION_OPS_SECRET = "fall-calls-ops-secret";
process.env.COACH_SIGNING_SECRET = "fall-calls-signing-secret";

import { FALL_RAIN_DATES, FALL_SUNDAYS } from "../src/data/fall-2026";
import { runFallCall } from "../src/lib/fall-call-run";
import { POST as fallCallsPOST } from "../src/app/api/admin/fall-calls/route";

// THE weather-call invariants. This engine emails paying families and changes
// what /fall tells them, so the failure modes that matter are: telling the
// wrong group, telling a refunded family, telling a family twice, leaking a
// child's data to Resend, marking a session cancelled with nobody told, and
// doing anything at all on a dry run or an unauthenticated request.

const [, W2, W3] = FALL_SUNDAYS;
const [R1] = FALL_RAIN_DATES;
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const ADMIN_EMAIL = "nextgenacademypb@gmail.com";

// Child fields are in every roster fixture ON PURPOSE — the "must not forward"
// assertions only mean something if the data is actually in the payload.
const CHILD_NAME = "Rosalind";
const ALLERGY = "peanut allergy — carries an EpiPen";
const EMERGENCY = "Aunt Meg";
const EMERGENCY_PHONE = "240-555-0134";

const GREEN_A = "green.a@calls.org";
const GREEN_B = "green.b@calls.org";
const YELLOW_A = "yellow.a@calls.org";
const REFUNDED = "refunded@calls.org";

let seq = 0;
function regRow(email: string, parentName: string, group: string, status = "Confirmed") {
  return {
    id: `reg-${++seq}`,
    created_time: "2026-09-01T12:00:00.000Z",
    properties: {
      "Parent Name": { title: [{ plain_text: parentName }] },
      "Parent Email": { email },
      "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
      "Child Birth Year": { number: 2014 },
      Allergies: { rich_text: [{ plain_text: ALLERGY }] },
      "Emergency Name": { rich_text: [{ plain_text: EMERGENCY }] },
      "Emergency Phone": { phone_number: EMERGENCY_PHONE },
      Group: { select: { name: group } },
      Status: { select: { name: status } },
    },
  };
}

const ROSTER = () => [
  regRow(GREEN_A, "Dana Fields", "Green"),
  regRow(GREEN_A, "Dana Fields", "Green"), // second kid, same family
  regRow(GREEN_B, "Priya Shah", "Green"),
  regRow(YELLOW_A, "Omar Diaz", "Yellow"),
  regRow(REFUNDED, "Refund Family", "Green", "Refunded"),
];

// A tiny stateful Notion: the calls DB reflects every PATCH/create made to it.
interface CallsPage {
  id: string;
  properties: Record<string, unknown>;
}
let callsPages: CallsPage[] = [];

function callsQueryResponse() {
  return { results: callsPages, has_more: false, next_cursor: null };
}

// Notion answers a write's `{ text: { content } }` with `plain_text` on read —
// mirror that, or the engine would (correctly) fail to read back its own row.
function asStored(props: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const v = value as { title?: unknown[]; rich_text?: unknown[] };
    const runs = (arr: unknown[]) =>
      arr.map((r) => {
        const run = r as { text?: { content?: string } };
        return { ...run, plain_text: run.text?.content ?? "" };
      });
    if (Array.isArray(v?.title)) out[key] = { title: runs(v.title) };
    else if (Array.isArray(v?.rich_text)) out[key] = { rich_text: runs(v.rich_text) };
    else out[key] = value;
  }
  return out;
}

function applyPatch(call: RecordedFetch) {
  const id = call.url.split("/pages/")[1];
  const page = callsPages.find((p) => p.id === id);
  const body = JSON.parse(call.body || "{}") as { properties?: Record<string, unknown> };
  if (page) Object.assign(page.properties, asStored(body.properties));
  return { id };
}

function createPage(call: RecordedFetch) {
  const body = JSON.parse(call.body || "{}") as { properties?: Record<string, unknown> };
  const page = { id: `call-${callsPages.length + 1}`, properties: asStored(body.properties) };
  callsPages.push(page);
  return { id: page.id };
}

function titleRow(date: string, props: Record<string, unknown> = {}): CallsPage {
  return {
    id: `seed-${date}`,
    properties: { Date: { title: [{ plain_text: date }] }, ...props },
  };
}

interface WorldOpts {
  roster?: unknown[];
  rosterStatus?: number;
  callsStatus?: number;
  failResendFor?: string;
}

function installWorld(stub: FetchStub, opts: WorldOpts = {}) {
  stub
    .onDynamic("databases/fall-calls-regs-db/query", () => ({
      status: opts.rosterStatus ?? 200,
      json: { results: opts.roster ?? ROSTER(), has_more: false },
    }))
    .onDynamic("databases/fall-calls-db/query", () => ({
      status: opts.callsStatus ?? 200,
      json: callsQueryResponse(),
    }))
    .on(/\/v1\/pages\/[^/]+$/, (call: RecordedFetch) => applyPatch(call))
    .on(/\/v1\/pages$/, (call: RecordedFetch) => createPage(call))
    .onDynamic("api.resend.com", (call) => {
      if (opts.failResendFor && call.body.includes(opts.failResendFor)) {
        return { status: 500, json: { name: "internal_server_error", message: "boom" } };
      }
      return { status: 200, json: { id: "email_test" } };
    })
    .install();
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  seq = 0;
  callsPages = [];
});
test.afterEach(() => stub.uninstall());

const sends = () => stub.calls.filter((c) => c.url.includes("api.resend.com"));
const notionWrites = () =>
  stub.calls.filter(
    (c) => c.url.includes("api.notion.com") && (c.method === "PATCH" || /\/v1\/pages$/.test(c.url)),
  );
const recipientsOf = (c: RecordedFetch) => {
  const body = JSON.parse(c.body) as { to: string | string[] };
  return Array.isArray(body.to) ? body.to : [body.to];
};
const writtenProps = () =>
  notionWrites().flatMap((c) => Object.keys((JSON.parse(c.body) as { properties?: object }).properties ?? {}));

test.describe("weather call — egress + dry run", () => {
  test("reaches only Notion + Resend", async () => {
    installWorld(stub);
    await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(new URL(call.url).host);
    }
  });

  test("a dry run returns the full plan with ZERO writes and ZERO sends", async () => {
    installWorld(stub);
    const res = await runFallCall({
      action: "cancel",
      date: W2,
      groups: ["Green"],
      note: "steady rain",
      dryRun: true,
      todayIso: W2,
    });
    expect(res.ok).toBe(true);
    expect(notionWrites()).toHaveLength(0);
    expect(sends()).toHaveLength(0);
    if (!res.ok) return;
    expect(res.written).toBe(false);
    expect(res.email?.recipients.sort()).toEqual([GREEN_A, GREEN_B].sort());
    expect(res.email?.preview).toContain("Please don't head to the courts");
    expect(res.makeups).toEqual([{ group: "Green", makeupDate: R1 }]);
    expect(res.cupf.map((r) => r.date)).toEqual([R1]);
    expect(res.whatsapp[0].text).toContain("Green Ball is CANCELLED today");
  });
});

test.describe("weather call — who gets told", () => {
  test("only Confirmed families in the cancelled group, once per family, admin BCC'd", async () => {
    installWorld(stub);
    const res = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    expect(res.ok).toBe(true);

    const to = sends().flatMap(recipientsOf).sort();
    expect(to).toEqual([GREEN_A, GREEN_B].sort()); // no Yellow, no Refunded, no double
    for (const s of sends()) {
      const body = JSON.parse(s.body) as { bcc?: string | string[] };
      expect([body.bcc].flat()).toContain(ADMIN_EMAIL);
    }
  });

  test("no child name, birth year, allergy or emergency contact reaches Resend", async () => {
    installWorld(stub);
    await runFallCall({ action: "cancel", date: W2, groups: ["Green", "Yellow"], todayIso: W2 });
    expect(sends().length).toBeGreaterThan(0);
    for (const s of sends()) {
      expect(s.body).not.toContain(CHILD_NAME);
      expect(s.body).not.toContain(ALLERGY);
      expect(s.body).not.toContain(EMERGENCY);
      expect(s.body).not.toContain(EMERGENCY_PHONE);
      expect(s.body).not.toContain("2014");
    }
  });

  test("a family in only one of two cancelled groups hears only about theirs", async () => {
    installWorld(stub);
    await runFallCall({ action: "cancel", date: W2, groups: ["Green", "Yellow"], todayIso: W2 });
    const yellowMail = sends().find((s) => recipientsOf(s).includes(YELLOW_A))!;
    const subject = (JSON.parse(yellowMail.body) as { subject: string }).subject;
    expect(subject).toContain("Yellow Ball cancelled");
    expect(subject).not.toContain("Green");
  });

  test("an extra address (paid off-site, no roster row) is emailed too", async () => {
    installWorld(stub);
    await runFallCall({
      action: "cancel",
      date: W2,
      groups: ["Green"],
      extraEmails: "Invoice.Family@calls.org",
      todayIso: W2,
    });
    expect(sends().flatMap(recipientsOf)).toContain("invoice.family@calls.org");
  });

  test("an invalid extra address refuses the whole call before any write", async () => {
    installWorld(stub);
    const res = await runFallCall({
      action: "cancel",
      date: W2,
      groups: ["Green"],
      extraEmails: "not-an-email",
      todayIso: W2,
    });
    expect(res.ok).toBe(false);
    expect(notionWrites()).toHaveLength(0);
    expect(sends()).toHaveLength(0);
  });
});

test.describe("weather call — what gets written", () => {
  test("a live cancel writes the status, then stamps Notified — nothing else", async () => {
    installWorld(stub);
    const res = await runFallCall({
      action: "cancel",
      date: W2,
      groups: ["Green"],
      note: "steady rain",
      todayIso: W2,
    });
    expect(res.ok).toBe(true);
    const page = callsPages.find((p) => JSON.stringify(p.properties).includes(W2))!;
    expect(page.properties["Green"]).toEqual({ select: { name: "Cancelled" } });
    expect(page.properties["Yellow"]).toBeUndefined();
    expect((page.properties["Green Notified"] as { date: { start: string } }).date.start).toBeTruthy();
    const allowed = new Set(["Date", "Green", "Yellow", "CUPF", "Note", "Green Notified", "Yellow Notified"]);
    for (const prop of writtenProps()) expect(allowed.has(prop), prop).toBe(true);
  });

  test("tapping cancel twice does not email twice", async () => {
    installWorld(stub);
    await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    const first = sends().length;
    const again = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    expect(sends().length).toBe(first);
    expect(again.ok && again.email?.skipped).toEqual([{ group: "Green", reason: "already_notified" }]);
  });

  test("resend: true is the deliberate way to email again", async () => {
    installWorld(stub);
    await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    const first = sends().length;
    await runFallCall({ action: "cancel", date: W2, groups: ["Green"], resend: true, todayIso: W2 });
    expect(sends().length).toBe(first * 2);
  });

  test("a failed send leaves Notified unstamped so it can be retried", async () => {
    installWorld(stub, { failResendFor: GREEN_B });
    const res = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    expect(res.ok && res.email?.failed).toEqual([GREEN_B]);
    const page = callsPages.find((p) => JSON.stringify(p.properties).includes(W2))!;
    expect(page.properties["Green"]).toEqual({ select: { name: "Cancelled" } });
    expect(page.properties["Green Notified"]).toBeUndefined();
  });

  test("a past date is recorded but nobody is emailed", async () => {
    installWorld(stub);
    const res = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W3 });
    expect(res.ok && res.email?.skipped).toEqual([{ group: "Green", reason: "past_date" }]);
    expect(sends()).toHaveLength(0);
    expect(notionWrites().length).toBeGreaterThan(0);
  });

  test("'we're on' marks Held, clears any stamp, and emails nobody", async () => {
    callsPages = [
      titleRow(W2, {
        Green: { select: { name: "Cancelled" } },
        "Green Notified": { date: { start: "2026-09-27T15:00:00.000Z" } },
      }),
    ];
    installWorld(stub);
    const res = await runFallCall({ action: "on", date: W2, groups: ["Green"], todayIso: W2 });
    expect(res.ok).toBe(true);
    expect(sends()).toHaveLength(0);
    expect(callsPages[0].properties["Green"]).toEqual({ select: { name: "Held" } });
    expect(callsPages[0].properties["Green Notified"]).toEqual({ date: null });
    // Families were already told it was off — Sam is warned to correct that.
    expect(res.ok && res.warnings.join(" ")).toContain("already emailed");
  });

  test("the CUPF action writes only the CUPF column, on rain dates only", async () => {
    installWorld(stub);
    const ok = await runFallCall({ action: "cupf", date: R1, cupf: "Booked", todayIso: W2 });
    expect(ok.ok).toBe(true);
    expect(writtenProps().filter((p) => p !== "Date")).toEqual(["CUPF"]);
    const bad = await runFallCall({ action: "cupf", date: W3, cupf: "Booked", todayIso: W2 });
    expect(bad.ok).toBe(false);
  });

  test("a group that doesn't play that date is refused (Yellow on an unclaimed rain date)", async () => {
    installWorld(stub);
    const res = await runFallCall({ action: "cancel", date: R1, groups: ["Yellow"], todayIso: R1 });
    expect(res.ok).toBe(false);
    expect(notionWrites()).toHaveLength(0);
  });
});

test.describe("weather call — fails closed before it half-acts", () => {
  test("roster unreadable → nothing written, nothing sent", async () => {
    installWorld(stub, { rosterStatus: 500 });
    const res = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe("roster_unreadable");
    expect(notionWrites()).toHaveLength(0);
    expect(sends()).toHaveLength(0);
  });

  test("tracker unreadable → nothing written, nothing sent", async () => {
    installWorld(stub, { callsStatus: 503 });
    const res = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
    expect(!res.ok && res.reason).toBe("calls_unreadable");
    expect(notionWrites()).toHaveLength(0);
    expect(sends()).toHaveLength(0);
  });

  test("tracker not configured → zero network calls", async () => {
    const saved = process.env.NOTION_FALL_CALLS_DB_ID;
    delete process.env.NOTION_FALL_CALLS_DB_ID;
    try {
      installWorld(stub);
      const res = await runFallCall({ action: "cancel", date: W2, groups: ["Green"], todayIso: W2 });
      expect(!res.ok && res.reason).toBe("not_configured");
      expect(stub.calls).toHaveLength(0);
    } finally {
      process.env.NOTION_FALL_CALLS_DB_ID = saved;
    }
  });
});

test.describe("weather call — route gate", () => {
  function req(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest("https://nextgenpbacademy.com/api/admin/fall-calls", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }
  const dry = { action: "cancel", date: W2, groups: ["Green"], dryRun: true };

  test("no cookie and no bearer → 401 with zero fetches", async () => {
    installWorld(stub);
    const res = await fallCallsPOST(req(dry));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("a wrong bearer → 401", async () => {
    installWorld(stub);
    const res = await fallCallsPOST(req(dry, { authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("the ops bearer reaches the engine", async () => {
    installWorld(stub);
    const res = await fallCallsPOST(req(dry, { authorization: "Bearer fall-calls-ops-secret" }));
    expect(res.status).toBe(200);
    expect(sends()).toHaveLength(0);
  });

  test("an unknown field is a 400 before any fetch — never a silent default", async () => {
    installWorld(stub);
    const res = await fallCallsPOST(
      req({ ...dry, grups: ["Green"] }, { authorization: "Bearer fall-calls-ops-secret" }),
    );
    expect(res.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
});
