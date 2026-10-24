import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createSessionCookieValue } from "../src/lib/coach-auth";
import { forwardPrivatePreview, privatePreviewPost, transportProbeCode } from "./fixtures/nga-parent-browser-transport";
const base = "http://127.0.0.1:3197", origin = "https://nextgenpbacademy.com";
const playerId = "00000000-0000-4000-8000-000000000001", registrationId = "00000000-0000-4000-8000-000000000004";
const statePath = process.env.NGA_SYNTHETIC_JOURNEY_STATE!, receiptPath = process.env.NGA_SYNTHETIC_JOURNEY_RECEIPTS!;
const signingKey = "synthetic-dedicated-parent-preview-signing-key-20261023";
let issuedCodes: string[] = [];
function remember(code: string): string { issuedCodes.push(code); return code; }
function assertArtifactsExcludeCodes(path: string) {
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) assertArtifactsExcludeCodes(file);
    else {
      expect(entry.name.endsWith(".zip") || entry.name.endsWith(".har") || entry.name.endsWith(".webm")).toBe(false);
      const content = readFileSync(file);
      for (const code of issuedCodes) expect(content.includes(Buffer.from(code)), "saved artifact must not contain a preview credential").toBe(false);
    }
  }
}
function state(value: object = {}) { writeFileSync(statePath, JSON.stringify(value)); }
async function wire(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    try {
      const url = new URL(route.request().url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) return await route.abort();
      if (["/api/coach/journey-preview", "/api/coach/journey-parent-capability", "/api/parent/journey-preview"].includes(url.pathname)) {
        return await forwardPrivatePreview(route, origin);
      }
      return await route.continue();
    } catch { await route.abort().catch(() => undefined); }
  });
}
function readOnlyReceipts() {
  const calls = readFileSync(receiptPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  expect(calls.every((call) => call.url.startsWith("https://api.notion.com/") && (call.method === "GET" || (call.method === "POST" && call.url.endsWith("/query"))))).toBe(true);
}
test.beforeEach(async ({ context }) => {
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe("1");
  issuedCodes = []; state(); writeFileSync(receiptPath, ""); await wire(context);
  process.env.COACH_SIGNING_SECRET = "synthetic-journey-coach-secret";
  await context.addCookies([{ name: "coach_session", value: createSessionCookieValue("synthetic-coach@example.invalid"), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
});
test.afterEach(async ({}, info) => {
  await info.attach("synthetic-provider-read-receipts", { body: readFileSync(receiptPath), contentType: "application/x-ndjson" });
  await info.attach("synthetic-source-state", { body: readFileSync(statePath), contentType: "application/json" });
  for (const attachment of info.attachments) if (attachment.body) for (const code of issuedCodes) expect(attachment.body.includes(Buffer.from(code)), "attachment must not contain a preview credential").toBe(false);
  assertArtifactsExcludeCodes(info.outputDir);
});
async function apiCode(context: BrowserContext): Promise<string> {
  const inspected = await privatePreviewPost(context.request, `${base}/api/coach/journey-parent-capability`, { headers: { origin }, data: { action: "inspect", playerId, registrationId } });
  expect(inspected.status()).toBe(200); const body = await inspected.json();
  const issued = await privatePreviewPost(context.request, `${base}/api/coach/journey-parent-capability`, { headers: { origin }, data: { action: "issue", playerId, registrationId, associationRevision: body.associationRevision, associationConfirmed: true, review: { confirmed: true, assessmentRevision: body.assessment.revision, focusId: "skill-6" } } });
  expect(issued.status()).toBe(200); return remember((await issued.json()).code);
}
async function uiCode(page: Page): Promise<string> {
  await page.goto("/coach/journey");
  await page.getByLabel("Player CRM record ID", { exact: true }).fill(playerId);
  await page.getByRole("button", { name: "Load recorded assessment" }).click();
  await expect(page.getByText("Green Ball. Recorded age: 10.")).toBeVisible();
  await page.getByLabel("Next focus", { exact: true }).selectOption("skill-6");
  await page.locator("summary").filter({ hasText: "Parent preview code" }).click();
  await page.getByLabel("Notion drop-in registration ID", { exact: true }).fill(registrationId);
  await page.getByRole("button", { name: "Inspect registration association" }).click();
  await expect(page.getByText("Registration record", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I reviewed these exact records/ }).check();
  await page.getByRole("button", { name: "Create parent preview code" }).click();
  await expect.poll(async () => (await page.getByLabel("Parent preview code", { exact: true }).inputValue()).startsWith("ngaj1.")).toBe(true);
  return remember(await page.getByLabel("Parent preview code", { exact: true }).inputValue());
}

test("NGA-C9 parent UI/API: exact coach association to anonymous parent requirements, no persistence or private telemetry", async ({ page, browser }, info) => {
  const code = await uiCode(page);
  const parent = await browser.newContext({ baseURL: base, viewport: page.viewportSize()! }); await wire(parent);
  try {
    const tab = await parent.newPage(); const analytics: string[] = [];
    tab.on("request", (request) => { if (new URL(request.url()).pathname === "/api/analytics") analytics.push(request.url()); });
    await tab.goto("/parent/next"); await tab.getByLabel("Preview code from your coach", { exact: true }).fill(code);
    await tab.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(tab.getByRole("heading", { name: "Reviewed next focus" })).toBeVisible();
    await expect(tab.getByText("Assessed level: Green Ball. Recorded age: 10.", { exact: true })).toBeVisible();
    await expect(tab.getByText(/^Reviewed .+ ET\. Expires .+ ET\.$/)).toBeVisible();
    await expect(tab.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
    await tab.getByRole("checkbox", { name: /The recorded age is current/ }).check();
    await tab.getByLabel("Venue name", { exact: true }).fill("Other court");
    await tab.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(tab.getByRole("heading", { name: "No matching sessions" })).toBeVisible();
    await tab.getByLabel("Venue priority", { exact: true }).selectOption("preferred");
    await tab.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(tab.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
    await expect(tab.getByRole("link", { name: "View session details" })).toHaveCount(0);
    expect(await tab.locator("body").innerText()).not.toMatch(/SyntheticChild|synthetic@example.invalid|2016/);
    expect(tab.url()).toBe(`${base}/parent/next`); expect(analytics).toEqual([]);
    expect(await tab.locator("body").evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
    await tab.screenshot({ path: info.outputPath("parent-reviewed-preview.png"), fullPage: true, mask: [tab.getByLabel("Preview code from your coach", { exact: true })] });
    readOnlyReceipts();
  } finally { await parent.close(); }
});

test("NGA-C9 parent API: source cancellation, reassignment, erasure, stale assessment and bad-purpose scope fail explicitly", async ({ context, browser }) => {
  const code = await apiCode(context); const parent = await browser.newContext();
  try {
    const request = (input: object = { preferences: {} }) => privatePreviewPost(parent.request, `${base}/api/parent/journey-preview`, { headers: { origin, authorization: `Bearer ${code}` }, data: input });
    const a = await request(); expect(a.status()).toBe(200); expect(await (await request()).json()).toEqual(await a.json());
    expect((await request({ playerId: "00000000-0000-4000-8000-000000000099" })).status()).toBe(400);
    for (const change of [{ registrationStatus: "Cancelled" }, { registrationChildName: "OtherSyntheticChild" }, { registrationArchived: true }, { revision: "2026-10-24T12:00:00Z" }, { cancelDuringInventory: true }]) {
      state(change); const response = await request(); expect([404, 409]).toContain(response.status()); expect(await response.json()).not.toHaveProperty("assessment");
    }
    state(); writeFileSync(receiptPath, "");
    expect((await privatePreviewPost(parent.request, `${base}/api/parent/journey-preview`, { headers: { origin, authorization: "Bearer cancel-token" }, data: { preferences: {} } })).status()).toBe(401);
    expect((await privatePreviewPost(parent.request, `${base}/api/parent/journey-preview`, { headers: { origin: "https://foreign.invalid", authorization: `Bearer ${code}` }, data: { preferences: {} } })).status()).toBe(403);
    expect(readFileSync(receiptPath, "utf8")).toBe("");
  } finally { await parent.close(); }
});

test("NGA-C9 parent UI/API: lost response retries safely and inventory failure never becomes no-match", async ({ context, page, browser }) => {
  const code = await apiCode(context); const parent = await browser.newContext({ baseURL: base, viewport: page.viewportSize()! }); await wire(parent);
  try {
    const tab = await parent.newPage(); await tab.goto("/parent/next"); await tab.getByLabel("Preview code from your coach", { exact: true }).fill(code);
    let lost = false; await tab.route("**/api/parent/journey-preview", async (route) => {
      const loseResponse = !lost; lost = true;
      await forwardPrivatePreview(route, origin, { loseResponse });
    });
    await tab.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(tab.getByText("The response was lost. You can safely retry this read-only preview.", { exact: true })).toBeVisible();
    await tab.getByRole("button", { name: "Preview next sessions" }).click(); await expect(tab.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
    state({ inventoryFailure: true }); await tab.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(tab.getByText("The current session or assessment source could not be checked. Try again before choosing a session.", { exact: true })).toBeVisible();
    await expect(tab.getByRole("heading", { name: "No matching sessions" })).toHaveCount(0); readOnlyReceipts();
  } finally { await parent.close(); }
});

test("NGA-C9 parent API: ten-minute code expires during inventory and releases no child result", async ({ context, browser }) => {
  const code = await apiCode(context), parts = code.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  claims.issuedAt = Math.floor(Date.now() / 1000) - 598; claims.expiresAt = claims.issuedAt + 600;
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url"), signature = createHmac("sha256", signingKey).update(`ngaj1.${payload}`).digest("base64url");
  remember(`ngaj1.${payload}.${signature}`);
  state({ delayInventory: true }); const parent = await browser.newContext();
  try {
    const response = await privatePreviewPost(parent.request, `${base}/api/parent/journey-preview`, { headers: { origin, authorization: `Bearer ngaj1.${payload}.${signature}` }, data: { preferences: {} } });
    expect(response.status()).toBe(401); expect(await response.json()).toMatchObject({ code: "parent_preview_access_revoked" });
    expect(readFileSync(receiptPath, "utf8")).toContain("/databases/synthetic-session-db/query"); readOnlyReceipts();
  } finally { await parent.close(); }
});

test("NGA-C9 parent harness: failed transport cannot retain credentials in reporters, files or attachments", async ({}, info) => {
  const probe = transportProbeCode(), output = info.outputPath("failed-transport"), report = info.outputPath("failed-transport.json");
  remember(probe);
  const child = spawnSync(process.execPath, ["./node_modules/playwright/cli.js", "test", "--config=playwright.nga-journey.config.ts", "--project=desktop", `--output=${output}`, "--reporter=line,json"], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", TMPDIR: "/tmp", CI: "1", PWTEST_CACHE_DIR: "/tmp/nga-parent-negative-transport-cache", NGA_SYNTHETIC_JOURNEY_STATE: statePath, NGA_SYNTHETIC_JOURNEY_RECEIPTS: receiptPath, NGA_JOURNEY_TRANSPORT_NEGATIVE: "1", PLAYWRIGHT_JSON_OUTPUT_NAME: report }, encoding: "utf8", timeout: 20_000 });
  const leaked = (value: string | Buffer) => Buffer.from(value).includes(Buffer.from(probe));
  let leaks = Number(leaked(child.stdout ?? "")) + Number(leaked(child.stderr ?? ""));
  function inspectAttachments(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(inspectAttachments); return; }
    for (const [key, entry] of Object.entries(value)) {
      if (key === "body" && typeof entry === "string") {
        const decoded = Buffer.from(entry, "base64");
        if (leaked(decoded)) { leaks += 1; (value as Record<string, unknown>)[key] = Buffer.from(decoded.toString("utf8").split(probe).join("[REDACTED_SYNTHETIC_CREDENTIAL]")).toString("base64"); }
      } else inspectAttachments(entry);
    }
  }
  function inspect(path: string) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) inspect(file);
      else {
        const content = readFileSync(file); let scrubbed = content.toString("utf8");
        if (leaked(content)) { leaks += 1; scrubbed = scrubbed.split(probe).join("[REDACTED_SYNTHETIC_CREDENTIAL]"); }
        if (file.endsWith(".json")) { const parsed = JSON.parse(scrubbed); inspectAttachments(parsed); scrubbed = JSON.stringify(parsed, null, 2); }
        writeFileSync(file, scrubbed);
      }
    }
  }
  inspect(info.outputDir);
  // Inspect original reporter bytes in memory, persist only sanitized evidence,
  // including the deliberately broken guard-mutation controls.
  writeFileSync(info.outputPath("failed-transport.log"), `${child.stdout ?? ""}${child.stderr ?? ""}`.split(probe).join("[REDACTED_SYNTHETIC_CREDENTIAL]"));
  expect(child.error === undefined, "nested failure reporter control completed").toBe(true);
  expect(child.status).toBe(1);
  const result = JSON.parse(readFileSync(report, "utf8"));
  expect(result.stats.unexpected).toBe(2);
  expect(leaks, "original JSON, text, artifacts and attachments must contain no credential").toBe(0);
});
