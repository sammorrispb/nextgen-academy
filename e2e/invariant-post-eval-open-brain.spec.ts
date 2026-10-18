import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";
import { runPostEvalFollowup } from "../src/lib/post-eval-followup-run";

// ── The post-eval follow-up tells Open Brain the evaluation happened ─────────
// Its third egress beside Notion and Resend (2026-10-18): one leads-ingest POST
// per sent follow-up, as the trialed stage, carrying the parent's identifiers,
// the child's first name and age, and the level. The coach's observations are
// the parent's email, not a record about a child: they never leave the
// function. A preview or a failed send tells Open Brain nothing, and a dead
// Open Brain never turns a sent email into a retryable failure.

const TOUCHED_ENV = [
  "NOTION_API_KEY",
  "RESEND_API_KEY",
  "NOTION_SESSIONS_DB_ID",
  "NOTION_DROPINS_DB_ID",
  "OPEN_BRAIN_INGEST_URL",
  "LEAD_INGEST_TOKEN",
] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map((key) => [key, process.env[key]]));
const stub = new FetchStub();
const OBSERVATIONS = "FORBIDDEN-OBSERVATION needs reps on the third-shot drop";
const body = { playerId: "synthetic-player", level: "Green" as const, observations: OBSERVATIONS };

test.beforeEach(() => {
  process.env.NOTION_API_KEY = "ntn_test";
  process.env.RESEND_API_KEY = "re_test";
  process.env.OPEN_BRAIN_INGEST_URL = "https://ob.test.local/functions/v1/leads-ingest";
  process.env.LEAD_INGEST_TOKEN = "ob_token_eval";
  delete process.env.NOTION_SESSIONS_DB_ID;
  delete process.env.NOTION_DROPINS_DB_ID;
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => {
  for (const key of TOUCHED_ENV) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function player() {
  stub.onDynamic("/pages/synthetic-player", (call) =>
    call.method === "PATCH"
      ? { status: 200, json: { id: "synthetic-player" } }
      : {
          status: 200,
          json: {
            properties: {
              "Parent Email": { email: "parent@example.org" },
              "Parent Phone": { phone_number: "(301) 555-0100" },
              "Parent Name": { rich_text: [{ plain_text: "Synthetic Parent" }] },
              "Player Name": { title: [{ plain_text: "Synthetic Player" }] },
              Age: { number: 9 },
              Birthdate: { date: { start: "2017-03-04" } },
              Status: { select: { name: "Lead" } },
            },
          },
        },
  );
}

test("a sent follow-up reaches Open Brain once, as trialed, with the sanctioned fields only", async () => {
  player();
  stub.on("api.resend.com", { id: "synthetic-message" });
  stub.on("ob.test.local", { ok: true });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);

  const ob = stub.callsTo("ob.test.local");
  expect(ob).toHaveLength(1);
  const sent = JSON.parse(ob[0].body);
  expect(sent).toMatchObject({
    business: "nga",
    source: "nga_eval_completed",
    initial_stage: "trialed",
    activity_type: "evaluation",
    channel: "nga",
    summary: "Evaluation completed: Green Ball",
    email: "parent@example.org",
    phone: "(301) 555-0100",
    name: "Synthetic Parent",
    interest: "Green",
  });
  expect(sent.metadata).toEqual({ child_first_name: "Synthetic", child_age: 9, level: "Green", notion_updated: true });
  expect(ob[0].body).not.toContain("FORBIDDEN-OBSERVATION");
  expect(ob[0].body).not.toContain("third-shot");
  expect(ob[0].body).not.toContain("2017");
});

test("a preview tells Open Brain nothing", async () => {
  player();
  stub.on("ob.test.local", { ok: true });
  const result = await runPostEvalFollowup(body, { dryRun: true });
  expect(result.status).toBe(200);
  expect(stub.callsTo("ob.test.local")).toHaveLength(0);
});

test("a failed send tells Open Brain nothing", async () => {
  player();
  stub.on("api.resend.com", { name: "validation_error", message: "Synthetic failure" }, 422);
  stub.on("ob.test.local", { ok: true });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(500);
  expect(stub.callsTo("ob.test.local")).toHaveLength(0);
});

test("a rejected CRM write still reaches Open Brain, marked as such", async () => {
  stub.onDynamic("/pages/synthetic-player", (call) =>
    call.method === "PATCH"
      ? { status: 400, json: { message: "synthetic rejection" } }
      : {
          status: 200,
          json: {
            properties: {
              "Parent Email": { email: "parent@example.org" },
              "Player Name": { title: [{ plain_text: "Synthetic Player" }] },
            },
          },
        },
  );
  stub.on("api.resend.com", { id: "synthetic-message" });
  stub.on("ob.test.local", { ok: true });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(200);
  const ob = stub.callsTo("ob.test.local");
  expect(ob).toHaveLength(1);
  expect(JSON.parse(ob[0].body).metadata.notion_updated).toBe(false);
});

test("a dead Open Brain never turns a sent email into a retryable failure", async () => {
  player();
  stub.on("api.resend.com", { id: "synthetic-message" });
  stub.onDynamic("ob.test.local", () => {
    throw new Error("Synthetic Open Brain outage");
  });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);
  expect(stub.callsTo("api.resend.com")).toHaveLength(1);
});

test("with Open Brain unconfigured the follow-up still sends and makes no ingest call", async () => {
  delete process.env.OPEN_BRAIN_INGEST_URL;
  player();
  stub.on("api.resend.com", { id: "synthetic-message" });
  stub.on("ob.test.local", { ok: true });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(200);
  expect(stub.callsTo("ob.test.local")).toHaveLength(0);
});
