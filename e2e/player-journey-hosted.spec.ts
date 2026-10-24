import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HOSTED_STORIES, hostedTest as test, coachCookie, createHostedNgaAdapter, hostedCasesEnabled, nearExpiryCode, waitPast,
  type ControlReceipt, type HostedNgaAdapter } from "./fixtures/player-journey-hosted-adapter";

// The ordinary pure and browser configurations register no hosted tests. The
// dedicated config registers all eleven stories in both viewports, with no skips.
if (hostedCasesEnabled(process.env)) {
  let app: HostedNgaAdapter, before: ControlReceipt, screenshot: string | undefined;
  let issued: string[] = [];
  const root = resolve(__dirname, "..");
  test.beforeAll(async () => { app = await createHostedNgaAdapter(root); await app.control.attach(); });
  test.beforeEach(async ({ context }) => {
    app.guard(); await app.control.setState(app.fullState()); before = await app.control.observe();
    app.resetEvidence(); issued = []; screenshot = undefined;
    await app.wire(context);
    await context.addCookies([{ name: "coach_session", value: coachCookie(app.coachEmail, process.env.COACH_SIGNING_SECRET!),
      domain: new URL(app.origin).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  });
  async function shot(page: Page, info: TestInfo) {
    if (page.url() === "about:blank") await page.goto(`${app.origin}/coach/journey`);
    expect(new URL(page.url()).origin).toBe(app.origin);
    expect(page.url().includes("ngaj1.")).toBe(false);
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= innerWidth)).toBe(true);
    screenshot = info.outputPath("hosted-safe-view.png");
    await page.screenshot({ path: screenshot, fullPage: true, mask: [page.locator("input, textarea")] });
  }
  function scan(path: string) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) scan(file);
      else {
        expect(/\.(?:zip|har|webm)$/i.test(entry.name)).toBe(false);
        const bytes = readFileSync(file);
        expect(issued.every((code) => !bytes.includes(Buffer.from(code))), "owned artifacts exclude preview credentials").toBe(true);
      }
    }
  }
  test.afterEach(async ({ page }, info) => {
    if (!app || !before) return;
    const after = await app.control.observe(), boundary = app.evidence();
    expect(boundary.boundary_violations).toBe(0);
    expect(Object.keys(after.counters).every((key) => ["player", "registration", "inventory", "model", "tournaments", "geocode", "transport"].includes(key))).toBe(true);
    const delta = Object.fromEntries(Object.keys(after.counters).map((key) => [key, after.counters[key] - (before.counters[key] ?? 0)]));
    expect(Object.values(delta).every((count) => Number.isSafeInteger(count) && count >= 0)).toBe(true);
    const readCount = ["player", "registration", "inventory"].reduce((total, key) => total + (delta[key] ?? 0), 0);
    expect(info.title.startsWith("NGA-H03") ? readCount === 0 : readCount > 0).toBe(true);
    expect(boundary.http_statuses.length > 0).toBe(true);
    if (!screenshot) await shot(page, info);
    const file = info.outputPath("hosted-safe-evidence.json"), id = /^NGA-H\d{2}/.exec(info.title)![0];
    const evidence = { schema_version: 1, ...app.proof, case_id: id, title: info.title, viewport: info.project.use.viewport,
      expected: ["current-source-and-authority", "honest-ui-api-result", "preview-only-no-enrollment-or-attendance", "no-retained-preview-credential"],
      actual: { provider_revision_before: before.revision, provider_revision_after: after.revision, counters_before: before.counters,
        counters_after: after.counters, counter_delta: delta, ...boundary, preview_routes_only: true },
      screenshot_path: screenshot };
    writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await info.attach("hosted-safe-evidence", { path: file, contentType: "application/json" });
    await info.attach("hosted-safe-screenshot", { path: screenshot!, contentType: "image/png" });
    scan(info.outputDir);
  });
  async function load(page: Page) {
    await page.goto(`${app.origin}/coach/journey`);
    await page.getByLabel("Player CRM record ID", { exact: true }).fill(app.playerId);
    await page.getByRole("button", { name: "Load recorded assessment" }).click();
    await expect(page.getByText("Green Ball. Recorded age: 10.")).toBeVisible();
    await page.getByLabel("Next focus", { exact: true }).selectOption("skill-6");
    await page.getByRole("checkbox", { name: /I confirmed the recorded age/ }).check();
    await page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ }).check();
  }
  async function apiCode(context: BrowserContext): Promise<string> {
    const inspection = await app.post(context.request, "/api/coach/journey-parent-capability", { action: "inspect", playerId: app.playerId, registrationId: app.registrationId });
    expect(inspection.status()).toBe(200); const body = await inspection.json();
    const result = await app.post(context.request, "/api/coach/journey-parent-capability", { action: "issue", playerId: app.playerId, registrationId: app.registrationId,
      associationRevision: body.associationRevision, associationConfirmed: true,
      review: { confirmed: true, assessmentRevision: body.assessment.revision, focusId: "skill-6" } });
    expect(result.status()).toBe(200); const code: unknown = (await result.json()).code;
    expect(typeof code === "string" && code.startsWith("ngaj1.")).toBe(true);
    issued.push(code as string); return code as string;
  }
  async function uiCode(page: Page): Promise<string> {
    await load(page);
    await page.locator("summary").filter({ hasText: "Parent preview code" }).click();
    await page.getByLabel("Notion drop-in registration ID", { exact: true }).fill(app.registrationId);
    await page.getByRole("button", { name: "Inspect registration association" }).click();
    await expect(page.getByText("Registration record", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /I reviewed these exact records/ }).check();
    await page.getByRole("button", { name: "Create parent preview code" }).click();
    await expect.poll(async () => (await page.getByLabel("Parent preview code", { exact: true }).inputValue()).startsWith("ngaj1.")).toBe(true);
    const code = await page.getByLabel("Parent preview code", { exact: true }).inputValue(); issued.push(code); return code;
  }
  const review = (revision: string) => ({ assessmentRevision: revision, focusId: "skill-6", confirmed: true, ageConfirmed: true });

  test(HOSTED_STORIES[0], async ({ page }) => {
    await load(page); await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
    await expect(page.getByText("Next focus for this preview:")).toContainText("Serve and Return");
    await expect(page.getByText("Confirm this program’s age range", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "View session details" })).toHaveCount(0);
    await app.control.patchState({ full: true }); await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "No matching sessions" })).toBeVisible();
    await app.control.patchState({ inventory_failure: true }); await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "Preview unavailable" })).toBeVisible();
  });
  test(HOSTED_STORIES[1], async ({ page }) => {
    await load(page); await app.control.patchState({ assessment_revision: 2 });
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "Assessment changed" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /I confirmed the recorded age/ })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Preview next sessions" })).toBeDisabled();
  });
  test(HOSTED_STORIES[2], async ({ context, browser }) => {
    const counters = (await app.control.observe()).counters;
    expect((await app.post(context.request, "/api/coach/journey-preview", { playerId: app.playerId }, { origin: "https://foreign.invalid" })).status()).toBe(403);
    const anonymous = await browser.newContext();
    try { expect((await app.post(anonymous.request, "/api/coach/journey-preview", { playerId: app.playerId })).status()).toBe(401); }
    finally { await anonymous.close(); }
    expect((await app.control.observe()).counters).toEqual(counters);
  });
  test(HOSTED_STORIES[3], async ({ page }) => {
    await load(page); let lost = false;
    await page.route("**/api/coach/journey-preview", (route) => { const lose = !lost; lost = true; return app.forward(route, { lose }); });
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByText("The response was lost. You can safely retry this read-only preview.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
  });
  test(HOSTED_STORIES[4], async ({ context }) => {
    const loaded = await app.post(context.request, "/api/coach/journey-preview", { playerId: app.playerId });
    expect(loaded.status()).toBe(200); const assessment = (await loaded.json()).assessment;
    const barrier = await app.barrier();
    const expires = Math.floor(Date.now() / 1000) + 2;
    await context.addCookies([{ name: "coach_session", value: coachCookie(app.coachEmail, process.env.COACH_SIGNING_SECRET!, expires), domain: new URL(app.origin).hostname,
      path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    const pending = app.post(context.request, "/api/coach/journey-preview", { playerId: app.playerId, review: review(assessment.revision), preferences: {} });
    try { await barrier.blocked(); await waitPast(expires); }
    finally { await barrier.release(); }
    const response = await pending;
    expect(response.status()).toBe(401); expect(await response.json()).toEqual({ error: "Unauthorized", code: "coach_access_revoked" });
  });
  test(HOSTED_STORIES[5], async ({ page }) => {
    await load(page); const barrier = await app.barrier();
    const response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/coach/journey-preview");
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    try {
      await barrier.blocked(); await expect(page.getByText("Checking the assessment and upcoming sessions.", { exact: true })).toBeVisible();
      await page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ }).uncheck();
      await expect(page.getByText("Checking the assessment and upcoming sessions.", { exact: true })).toHaveCount(0);
    } finally { await barrier.release(); }
    await response;
    await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toHaveCount(0);
    await page.getByRole("checkbox", { name: /I reviewed this recorded assessment/ }).check();
    await expect(page.getByRole("button", { name: "Preview next sessions" })).toBeEnabled();
    await page.getByRole("button", { name: "Preview next sessions" }).click();
    await expect(page.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
  });
  test(HOSTED_STORIES[6], async ({ page, browser }, info) => {
    const code = await uiCode(page), parent = await browser.newContext({ baseURL: app.origin, viewport: page.viewportSize()! }); await app.wire(parent);
    try {
      const tab = await parent.newPage(); const analytics: string[] = [];
      tab.on("request", (request) => { if (new URL(request.url()).pathname === "/api/analytics") analytics.push("analytics"); });
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
      expect(tab.url()).toBe(`${app.origin}/parent/next`); expect(analytics).toEqual([]);
      expect(await tab.evaluate((code) => [...Object.values(localStorage), ...Object.values(sessionStorage)].every((value) => !value.includes(code)), code)).toBe(true);
      await tab.evaluate(() => { localStorage.clear(); sessionStorage.clear(); history.replaceState(null, "", "/parent/next"); });
      await shot(tab, info);
    } finally { await parent.close(); }
  });
  test(HOSTED_STORIES[7], async ({ context, browser, page }, info) => {
    const code = await apiCode(context), parent = await browser.newContext({ baseURL: app.origin, viewport: page.viewportSize()! });
    const request = (value: object = { preferences: {} }, credential = code, origin = app.origin) => app.post(parent.request, "/api/parent/journey-preview", value, { origin, authorization: `Bearer ${credential}` });
    try {
      const first = await request(); expect(first.status()).toBe(200); expect(await (await request()).json()).toEqual(await first.json());
      expect((await request({ playerId: "00000000-0000-4000-8000-000000000099" })).status()).toBe(400);
      for (const change of [{ registration_status: "Cancelled" as const }, { identity: "different-child" as const }, { registration_archived: true }, { assessment_revision: 2 }]) {
        await app.control.setState({ ...app.fullState(), ...change });
        const response = await request(); expect([404, 409]).toContain(response.status()); expect(await response.json()).not.toHaveProperty("assessment");
      }
      await app.control.setState(app.fullState()); const barrier = await app.barrier(); const pending = request();
      try { await barrier.blocked(); await app.control.patchState({ registration_status: "Cancelled" }); }
      finally { await barrier.release(); }
      const revoked = await pending; expect([404, 409]).toContain(revoked.status()); expect(await revoked.json()).not.toHaveProperty("assessment");
      const counters = (await app.control.observe()).counters;
      expect((await request({ preferences: {} }, "cancel-token")).status()).toBe(401);
      expect((await request({ preferences: {} }, code, "https://foreign.invalid")).status()).toBe(403);
      expect((await app.control.observe()).counters).toEqual(counters);
      await app.wire(parent); const tab = await parent.newPage(); await tab.goto(`${app.origin}/parent/next`);
      await tab.getByLabel("Preview code from your coach", { exact: true }).fill(code);
      const rejected = tab.waitForResponse((response) => new URL(response.url()).pathname === "/api/parent/journey-preview");
      await tab.getByRole("button", { name: "Preview next sessions" }).click(); expect([404, 409]).toContain((await rejected).status());
      await expect(tab.getByRole("heading", { name: "Reviewed next focus" })).toHaveCount(0); await shot(tab, info);
    } finally { await parent.close(); }
  });
  test(HOSTED_STORIES[8], async ({ context, page, browser }, info) => {
    const code = await apiCode(context), parent = await browser.newContext({ baseURL: app.origin, viewport: page.viewportSize()! }); await app.wire(parent);
    try {
      const tab = await parent.newPage(); await tab.goto("/parent/next"); await tab.getByLabel("Preview code from your coach", { exact: true }).fill(code);
      let lost = false; await tab.route("**/api/parent/journey-preview", (route) => { const lose = !lost; lost = true; return app.forward(route, { lose }); });
      await tab.getByRole("button", { name: "Preview next sessions" }).click();
      await expect(tab.getByText("The response was lost. You can safely retry this read-only preview.", { exact: true })).toBeVisible();
      await tab.getByRole("button", { name: "Preview next sessions" }).click();
      await expect(tab.getByRole("heading", { name: "Coach confirmation needed" })).toBeVisible();
      await app.control.patchState({ inventory_failure: true }); await tab.getByRole("button", { name: "Preview next sessions" }).click();
      await expect(tab.getByText("The current session or assessment source could not be checked. Try again before choosing a session.", { exact: true })).toBeVisible();
      await expect(tab.getByRole("heading", { name: "No matching sessions" })).toHaveCount(0); await shot(tab, info);
    } finally { await parent.close(); }
  });
  test(HOSTED_STORIES[9], async ({ context, browser, page }, info) => {
    const code = await apiCode(context), parent = await browser.newContext({ baseURL: app.origin, viewport: page.viewportSize()! }), barrier = await app.barrier();
    const expiring = nearExpiryCode(code, process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET!); issued.push(expiring.code);
    const pending = app.post(parent.request, "/api/parent/journey-preview", { preferences: {} }, { authorization: `Bearer ${expiring.code}` });
    try {
      try { await barrier.blocked(); await waitPast(expiring.expires); }
      finally { await barrier.release(); }
      const response = await pending; expect(response.status()).toBe(401);
      expect(await response.json()).toMatchObject({ code: "parent_preview_access_revoked" });
      await app.wire(parent); const tab = await parent.newPage(); await tab.goto(`${app.origin}/parent/next`);
      await tab.getByLabel("Preview code from your coach", { exact: true }).fill(expiring.code);
      const rejected = tab.waitForResponse((response) => new URL(response.url()).pathname === "/api/parent/journey-preview");
      await tab.getByRole("button", { name: "Preview next sessions" }).click(); expect((await rejected).status()).toBe(401);
      await expect(tab.getByRole("heading", { name: "Reviewed next focus" })).toHaveCount(0); await shot(tab, info);
    } finally { await parent.close(); }
  });
  test(HOSTED_STORIES[10], async ({ context, browser, page }, info) => {
    const code = await apiCode(context), parent = await browser.newContext({ baseURL: app.origin, viewport: page.viewportSize()! }); await app.wire(parent);
    try {
      const tab = await parent.newPage(); await tab.goto("/parent/next"); await tab.getByLabel("Preview code from your coach", { exact: true }).fill(code);
      await tab.route("**/api/parent/journey-preview", (route) => app.forward(route, { lose: true }));
      await tab.getByRole("button", { name: "Preview next sessions" }).click();
      await expect(tab.getByText("The response was lost. You can safely retry this read-only preview.", { exact: true })).toBeVisible();
      expect(tab.url()).toBe(`${app.origin}/parent/next`);
      expect(await tab.evaluate((code) => [...Object.values(localStorage), ...Object.values(sessionStorage)].every((value) => !value.includes(code)), code)).toBe(true);
      await tab.evaluate(() => { localStorage.clear(); sessionStorage.clear(); history.replaceState(null, "", "/parent/next"); });
      await parent.request.dispose();
      let message = "";
      try { await app.post(parent.request, "/api/parent/journey-preview", { preferences: {} }, { authorization: `Bearer ${code}` }); }
      catch (error) { message = error instanceof Error ? error.message : "unexpected"; }
      expect(message).toBe("nga_hosted_request_failed"); await shot(tab, info);
    } finally { await parent.close(); }
  });
}
