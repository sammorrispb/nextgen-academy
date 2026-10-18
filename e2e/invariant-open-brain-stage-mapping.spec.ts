import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";
import { SOURCE_STAGES, ingestToOpenBrain, stageForSource } from "../src/lib/open-brain-ingest";

// ── The stage a source proves travels with the ingest ────────────────────────
// Until 2026-10-18 no NGA ingest named a pipeline stage, so Open Brain wrote
// its default, inquiry, for every touch: paying camp families were created AT
// inquiry, and a waiver signature or a coach check-in knocked enrolled families
// back to it. The mapping lives in the one helper all 27 call sites pass
// through, so the Stripe webhook (a Slop-Free Zone that runs its ingests
// inside after()) is not edited and the decision is made in one place.

const OB_URL = "https://ob.test.local/functions/v1/leads-ingest";
const stub = new FetchStub();
const saved: Record<string, string | undefined> = {};

test.beforeEach(() => {
  for (const k of ["OPEN_BRAIN_INGEST_URL", "LEAD_INGEST_TOKEN"]) saved[k] = process.env[k];
  process.env.OPEN_BRAIN_INGEST_URL = OB_URL;
  process.env.LEAD_INGEST_TOKEN = "ob_token_stage";
  stub.reset();
  stub.on("ob.test.local", { ok: true }).install();
});
test.afterEach(() => {
  stub.uninstall();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function sent(payload: Parameters<typeof ingestToOpenBrain>[0]) {
  await ingestToOpenBrain({ email: "parent-stage@example.com", name: "Stage Parent", ...payload });
  const calls = stub.callsTo("ob.test.local");
  expect(calls).toHaveLength(1);
  return JSON.parse(calls[0].body) as Record<string, unknown>;
}

const PAID_SOURCES = [
  "nga_summer_camp",
  "nga_fall_registration",
  "nga_picklpark_registration",
  "nga_monday_girls_registration",
  "nga_monday_girls_dropin",
  "nga_league_enrollment",
  "nga_lesson_purchase",
  "nga_mvf_junior_tournament",
  "nga_cluster_registration",
  "nga_crew_autoreserve",
];

// Touches that prove nothing about where a family is on the ladder.
const STAGELESS_SOURCES = [
  "nga_lead_form",
  "nga_contact_form",
  "nga_newsletter_signup",
  "nga_waiver_signed",
  "nga_crew_interest",
  "nga_waitlist",
  "nga_league_interest",
  "nga_yellowball_inquiry",
  "nga_schools_form",
  "nga_crew_commit",
  "nga_crew_poll_vote",
  "nga_lesson_booking_request",
  "nga_lesson_booking_confirmed",
  "nga_camp_refund",
];

test.describe("stageForSource", () => {
  test("every paid registration proves enrolled", () => {
    for (const source of PAID_SOURCES) expect(stageForSource(source), source).toBe("enrolled");
  });

  test("a completed evaluation proves trialed", () => {
    expect(stageForSource("nga_eval_completed")).toBe("trialed");
  });

  test("a Present check-in proves active; a No-show or an unlabelled check-in proves nothing", () => {
    expect(stageForSource("nga_attendance", { attendance: "Present" })).toBe("active");
    expect(stageForSource("nga_attendance", { attendance: "No-show" })).toBeUndefined();
    expect(stageForSource("nga_attendance", {})).toBeUndefined();
    expect(stageForSource("nga_attendance")).toBeUndefined();
  });

  test("a form, a waiver, a signup, an interest or a refund proves nothing, so Open Brain keeps the earned stage", () => {
    for (const source of STAGELESS_SOURCES) {
      expect(stageForSource(source), source).toBeUndefined();
      expect(Object.hasOwn(SOURCE_STAGES, source), `${source} must stay unmapped`).toBe(false);
    }
  });

  test("every source the Stripe webhook emits has an entry, and it is enrolled", () => {
    // The webhook handles paid events and refunds only, and its refund path
    // ingests from cancel-camp.ts, so every ingest IN the route is a paid one.
    // A new paid product lands here before it can ship without a stage.
    const route = readFileSync(join(__dirname, "../src/app/api/stripe/webhook/route.ts"), "utf8");
    const sources = [...route.matchAll(/source:\s*"(nga_[a-z_]+)"/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThanOrEqual(9);
    for (const source of new Set(sources)) {
      expect(Object.hasOwn(SOURCE_STAGES, source), `${source} is ingested by the webhook with no stage decision`).toBe(true);
      expect(SOURCE_STAGES[source], source).toBe("enrolled");
    }
  });
});

test.describe("the stage reaches Open Brain", () => {
  test("a paid source sends initial_stage enrolled", async () => {
    const body = await sent({ business: "nga", source: "nga_summer_camp", metadata: { child_first_name: "Kid", child_age: 9 } });
    expect(body.initial_stage).toBe("enrolled");
    expect(body.source).toBe("nga_summer_camp");
  });

  test("a stageless source sends no initial_stage at all", async () => {
    const body = await sent({ business: "nga", source: "nga_lead_form", metadata: { child_age: 9 } });
    expect(body).not.toHaveProperty("initial_stage");
  });

  test("a Present check-in sends active; a No-show sends nothing, from the same source", async () => {
    const present = await sent({ business: "nga", source: "nga_attendance", metadata: { child_first_name: "Kid", attendance: "Present" } });
    expect(present.initial_stage).toBe("active");
    stub.reset();
    stub.on("ob.test.local", { ok: true }).install();
    const noShow = await sent({ business: "nga", source: "nga_attendance", metadata: { child_first_name: "Kid", attendance: "No-show" } });
    expect(noShow).not.toHaveProperty("initial_stage");
    expect((noShow.metadata as Record<string, unknown>).attendance).toBe("No-show");
  });

  test("a caller's explicit stage wins over the map", async () => {
    const body = await sent({ business: "nga", source: "nga_summer_camp", initial_stage: "renewed" });
    expect(body.initial_stage).toBe("renewed");
  });

  test("the activity fields pass through untouched", async () => {
    const body = await sent({
      business: "nga",
      source: "nga_eval_completed",
      activity_type: "evaluation",
      channel: "nga",
      summary: "Evaluation completed: Green Ball",
    });
    expect(body).toMatchObject({ initial_stage: "trialed", activity_type: "evaluation", channel: "nga", summary: "Evaluation completed: Green Ball" });
  });
});
