import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";
import { runPostEvalFollowup } from "../src/lib/post-eval-followup-run";

const TOUCHED_ENV = ["NOTION_API_KEY", "RESEND_API_KEY", "NOTION_SESSIONS_DB_ID", "NOTION_DROPINS_DB_ID"] as const;
const savedEnv = Object.fromEntries(TOUCHED_ENV.map((key) => [key, process.env[key]]));
const stub = new FetchStub();
const body = { playerId: "synthetic-player", level: "Green" as const };

test.beforeEach(() => {
  process.env.NOTION_API_KEY = "ntn_test";
  process.env.RESEND_API_KEY = "re_test";
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

function player(status: string | null, patchStatus = 200) {
  stub.onDynamic("/pages/synthetic-player", (call) => call.method === "PATCH"
    ? { status: patchStatus, json: { id: "synthetic-player" } }
    : { status: 200, json: { properties: {
      "Parent Email": { email: "parent@example.org" },
      "Parent Name": { rich_text: [{ plain_text: "Synthetic Parent" }] },
      "Player Name": { title: [{ plain_text: "Synthetic Player" }] },
      Status: { select: status ? { name: status } : null },
    } } });
}

for (const status of ["Lead", "Trial", "Active", "Inactive", null]) {
  test(`sending evaluation advice preserves existing status ${status}`, async () => {
    player(status);
    stub.on("api.resend.com", { id: "synthetic-message" });
    const result = await runPostEvalFollowup(body);
    expect(result.status).toBe(200);
    expect(result.body.notion_updated).toBe(true);
    expect(stub.callsTo("api.resend.com")).toHaveLength(1);
    const writes = stub.calls.filter((call) => call.method === "PATCH");
    expect(writes).toHaveLength(1);
    const properties = JSON.parse(writes[0].body).properties;
    expect(properties).not.toHaveProperty("Status");
    expect(properties.Level.select.name).toBe("Green");
    expect(properties["Next Action"].rich_text[0].text.content).toContain("Post-eval email sent");
  });
}

test("preview cannot send or stamp a sent action", async () => {
  player("Lead");
  const result = await runPostEvalFollowup(body, { dryRun: true });
  expect(result.status).toBe(200);
  expect(result.body.dryRun).toBe(true);
  expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  expect(stub.calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
});

test("failed email cannot stamp a sent action or activate a player", async () => {
  player("Lead");
  stub.on("api.resend.com", { name: "validation_error", message: "Synthetic failure" }, 422);
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(500);
  expect(stub.calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
});

test("a rejected CRM write is not reported as updated after the email sends", async () => {
  player("Lead", 400);
  stub.on("api.resend.com", { id: "synthetic-message" });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);
  expect(result.body.notion_updated).toBe(false);
  expect(stub.callsTo("api.resend.com")).toHaveLength(1);
});

test("a CRM network failure after sending is not a retryable email failure", async () => {
  player("Lead");
  stub.reset();
  stub.onDynamic("/pages/synthetic-player", (call) => {
    if (call.method === "PATCH") throw new Error("Synthetic network failure");
    return { status: 200, json: { properties: {
      "Parent Email": { email: "parent@example.org" },
      "Player Name": { title: [{ plain_text: "Synthetic Player" }] },
    } } };
  });
  stub.on("api.resend.com", { id: "synthetic-message" });
  const result = await runPostEvalFollowup(body);
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);
  expect(result.body.notion_updated).toBe(false);
  expect(stub.callsTo("api.resend.com")).toHaveLength(1);
});
