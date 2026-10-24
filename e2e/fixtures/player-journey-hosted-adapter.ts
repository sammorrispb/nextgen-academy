import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { constants, closeSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { APIRequestContext, APIResponse, BrowserContext, Route } from "@playwright/test";
import { test as baseTest } from "@playwright/test";
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

type Env = Record<string, string | undefined>;
export type Checkout = { repository: string; commit: string; tree: string; branch: string; status: string };
export type ClosedState = { assessment_revision: number; registration_revision: number; assessment_archived: boolean;
  registration_archived: boolean; registration_status: "Confirmed" | "Cancelled"; identity: "matching" | "different-child" | "different-contact";
  level: "Red" | "Orange" | "Green" | "Yellow"; age: number; full: boolean; inventory_failure: boolean;
  model_mode: "invalid-json" | "empty-answers" | "contradictory"; tournament_mode: "adult" | "youth" | "unknown" | "none" | "mixed";
  dependency_failure: "healthy" | "auth-unavailable" | "inventory-unavailable" };
export type ControlReceipt = { revision: number; counters: Record<string, number>;
  barriers: Record<string, { barrier_id: string; released: boolean; blocked: number }> };
type Controller = { attach(): Promise<ControlReceipt>; observe(): Promise<ControlReceipt>;
  setState(state: ClosedState, options?: { expectedRevision: number }): Promise<ControlReceipt>;
  patchState(patch: Partial<ClosedState>): Promise<ControlReceipt>;
  arm(endpoint: string, id: string): Promise<ControlReceipt>; release(endpoint: string, id: string): Promise<ControlReceipt> };
const LD = "https://github.com/sammorrispb/community-os.git", NGA = "https://github.com/sammorrispb/nextgen-academy.git";
function fail(code = "nga_hosted_admission_refused"): never { throw new Error(code); }
function required(env: Env, key: string): string { const value = env[key]; if (!value) return fail(); return value; }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const sha1 = /^[a-f0-9]{40}$/;
export const HOSTED_STORIES = [
  "NGA-H01 coach: reviewed focus, capacity and source failure",
  "NGA-H02 coach: stale assessment requires fresh review",
  "NGA-H03 coach: absent authority and foreign origin precede family reads",
  "NGA-H04 coach: lost response retries without writes",
  "NGA-H05 coach: session expiry during inventory releases no child result",
  "NGA-H06 coach: changed review discards pending result and clears busy",
  "NGA-H07 parent: exact reviewed association and anonymous requirements",
  "NGA-H08 parent: source revocation and bad-purpose scope fail explicitly",
  "NGA-H09 parent: lost response and inventory failure remain honest",
  "NGA-H10 parent: code expires during inventory with no child result",
  "NGA-H11 parent harness: failed transport retains no preview credential",
] as const;

/** Run in the worker before Playwright's context/artifact fixture teardown.
 * Keep failure status, but leave no raw error for error-context.md to write.
 * PLAYWRIGHT_NO_COPY_PROMPT separately prevents the private DOM snapshot.
 */
export function clearPrivateFailure(info: { errors: unknown[]; status?: string; annotations: { type: string; description?: string }[] }): void {
  if (!info.errors.length) return;
  info.annotations.push({ type: "hosted-private-failure", description: "assertion-or-transport-failed" });
  info.errors.splice(0, info.errors.length);
}
export const hostedTest = baseTest.extend<{ privateArtifacts: void }>({
  privateArtifacts: [async ({ page }, runFixture, info) => {
    void page; // Teardown must run before the page/context artifact fixtures.
    try { await runFixture(); } finally { clearPrivateFailure(info); }
  }, { auto: true }],
});

export function hostedCasesEnabled(env: Env): boolean {
  if (env.NGA_HOSTED_ACCEPTANCE === undefined) return false;
  if (env.NGA_HOSTED_ACCEPTANCE !== "1") fail();
  return true;
}
export function checkSource(actual: Checkout, expected: { repository: string; commit: string; tree: string }): void {
  if (!actual || actual.repository !== expected.repository || actual.commit !== expected.commit || actual.tree !== expected.tree ||
    !sha1.test(actual.commit) || !sha1.test(actual.tree) || !actual.branch || ["main", "master", "HEAD"].includes(actual.branch) ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(actual.branch) || actual.status !== "") fail("nga_hosted_source_refused");
}
function checkout(root: string, repository: string): Checkout {
  const git = (...args: string[]) => execFileSync("/usr/bin/git", ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args], {
    cwd: root, encoding: "utf8", timeout: 5000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: "/usr/bin:/bin", NODE_ENV: "test", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
  });
  try {
    if (!isAbsolute(root) || realpathSync(root) !== root || resolve(root) !== root || git("rev-parse", "--show-toplevel").trim() !== root) fail();
    const remote = git("config", "--get", "remote.origin.url").trim();
    if (![repository, repository.replace("https://github.com/", "git@github.com:"), repository.replace("https://", "ssh://git@")].includes(remote)) fail();
    return { repository, commit: git("rev-parse", "HEAD").trim(), tree: git("rev-parse", "HEAD^{tree}").trim(),
      branch: git("symbolic-ref", "--quiet", "--short", "HEAD").trim(), status: git("status", "--porcelain=v1", "--untracked-files=all") };
  } catch { return fail("nga_hosted_source_refused"); }
}

export function checkConfigEnvironment(env: Env, listing = false): string {
  if (env.PLAYER_JOURNEY_HOSTED_FIXTURES !== "1" || !hostedCasesEnabled(env) ||
    (env.LD_SESSION_STAGING !== undefined && env.LD_SESSION_STAGING !== "0")) fail();
  for (const key of ["NODE_OPTIONS", "NODE_PATH", "NODE_EXTRA_CA_CERTS", "DOTENV_CONFIG_PATH", "NGA_SYNTHETIC_JOURNEY_FIXTURES", "NGA_SYNTHETIC_JOURNEY_STATE", "NGA_SYNTHETIC_JOURNEY_RECEIPTS"])
    if (env[key]) fail();
  const origin = required(env, "PLAYWRIGHT_BASE_URL");
  if (!/^https:\/\/pj-[a-z0-9-]{8,40}-nga\.vercel\.app$/.test(origin) || new URL(origin).origin !== origin) fail();
  const start = env.PLAYER_JOURNEY_EXECUTION_STARTED_AT;
  if (start !== undefined && (start.length !== 24 || !Number.isFinite(Date.parse(start)) || new Date(start).toISOString() !== start || Date.parse(start) > Date.now())) fail();
  if (!listing) for (const key of ["PLAYER_JOURNEY_LD_CHECKOUT", "PLAYER_JOURNEY_LD_COMMIT", "PLAYER_JOURNEY_LD_TREE", "PLAYER_JOURNEY_NGA_COMMIT", "PLAYER_JOURNEY_NGA_TREE",
    "PLAYER_JOURNEY_HOSTED_ADMISSION_PATH", "PLAYER_JOURNEY_HOSTED_ADMISSION_SHA256", "NGA_JOURNEY_FIXTURE_CONTROL_KEY", "COACH_SIGNING_SECRET", "NGA_JOURNEY_PREVIEW_SIGNING_SECRET",
    "COACH_ALLOWED_EMAILS", "NGA_JOURNEY_PLAYER_ID", "NGA_JOURNEY_REGISTRATION_ID", "NGA_HOSTED_OUTPUT_DIR", "PLAYER_JOURNEY_HOSTED_REPORT_PATH"]) required(env, key);
  return origin;
}

/** The only dynamic module path comes from a separately pinned, clean LD source
 * checkout. No shared code is loaded until its actual git binding passes. */
export async function createHostedNgaAdapter(ngaRoot: string, env: Env = process.env) {
  const origin = checkConfigEnvironment(env);
  const ldRoot = required(env, "PLAYER_JOURNEY_LD_CHECKOUT");
  const ldPin = { repository: LD, commit: required(env, "PLAYER_JOURNEY_LD_COMMIT"), tree: required(env, "PLAYER_JOURNEY_LD_TREE") };
  checkSource(checkout(ldRoot, LD), ldPin);
  const shared = await import(pathToFileURL(join(ldRoot, "scripts/lib/player-journey-hosted-fixtures.mjs")).href);
  const metadata = shared.loadHostedFixtureAdmission({ filePath: required(env, "PLAYER_JOURNEY_HOSTED_ADMISSION_PATH"), expectedSha256: required(env, "PLAYER_JOURNEY_HOSTED_ADMISSION_SHA256") });
  if (metadata.expectedSources.ld.repository !== LD || metadata.expectedSources.ld.commit !== ldPin.commit || metadata.expectedSources.ld.tree !== ldPin.tree) fail();
  const ngaPin = { repository: NGA, commit: required(env, "PLAYER_JOURNEY_NGA_COMMIT"), tree: required(env, "PLAYER_JOURNEY_NGA_TREE") };
  if (metadata.expectedSources.nga.repository !== NGA || metadata.expectedSources.nga.commit !== ngaPin.commit || metadata.expectedSources.nga.tree !== ngaPin.tree) fail();
  const initialNga = checkout(ngaRoot, NGA); checkSource(initialNga, ngaPin);
  const admission = { ...metadata, checkout: checkout(ldRoot, LD), now: new Date() };
  const authority = env.PLAYER_JOURNEY_EXECUTION_STARTED_AT === undefined ? shared.createHostedFixtureAuthority(admission) :
    shared.resumeHostedFixtureAuthority({ ...admission, executionStartedAt: env.PLAYER_JOURNEY_EXECUTION_STARTED_AT });
  const targets = shared.hostedFixtureTargets(authority);
  const pins = shared.hostedFixtureControlPins(authority);
  const proof = Object.freeze({ ...pins, repository: NGA,
    commit: ngaPin.commit, tree: ngaPin.tree, origin, provider_origin: targets.provider,
    provenance: "hosted-next-ui-api-synthetic-notion-projection", native_database_proven: false });
  if (targets.origins.nga !== origin || env.NGA_JOURNEY_PROVIDER !== "synthetic_https" || env.NGA_JOURNEY_FIXTURE_URL !== targets.provider ||
    env.NGA_JOURNEY_FIXTURE_RUN_ID !== targets.run_id || env.NGA_JOURNEY_FIXTURE_PROJECT_REF !== new URL(targets.database).hostname.split(".")[0] ||
    env.SITE_URL !== origin || (env.NEXT_PUBLIC_SITE_URL !== undefined && env.NEXT_PUBLIC_SITE_URL !== origin)) fail();
  const coachEmail = required(env, "COACH_ALLOWED_EMAILS");
  if (!/^synthetic-[a-z0-9-]+@example\.invalid$/.test(coachEmail) || !/^[A-Za-z0-9_-]{32,256}$/.test(required(env, "COACH_SIGNING_SECRET")) ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(required(env, "NGA_JOURNEY_PREVIEW_SIGNING_SECRET")) || env.COACH_SIGNING_SECRET === env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET) fail();
  const playerId = required(env, "NGA_JOURNEY_PLAYER_ID"), registrationId = required(env, "NGA_JOURNEY_REGISTRATION_ID");
  if (!uuid.test(playerId) || !uuid.test(registrationId) || playerId === registrationId) fail();
  const bindings = Object.fromEntries(["PLAYWRIGHT_BASE_URL", "SITE_URL", "NEXT_PUBLIC_SITE_URL", "NGA_JOURNEY_PROVIDER", "NGA_JOURNEY_FIXTURE_URL",
    "NGA_JOURNEY_FIXTURE_RUN_ID", "NGA_JOURNEY_FIXTURE_PROJECT_REF", "PLAYER_JOURNEY_HOSTED_ADMISSION_PATH", "PLAYER_JOURNEY_HOSTED_ADMISSION_SHA256",
    "PLAYER_JOURNEY_LD_CHECKOUT", "PLAYER_JOURNEY_LD_COMMIT", "PLAYER_JOURNEY_LD_TREE", "PLAYER_JOURNEY_NGA_COMMIT", "PLAYER_JOURNEY_NGA_TREE",
    "COACH_SIGNING_SECRET", "COACH_ALLOWED_EMAILS", "NGA_JOURNEY_PREVIEW_SIGNING_SECRET", "NGA_JOURNEY_FIXTURE_CONTROL_KEY",
    "NGA_JOURNEY_PLAYER_ID", "NGA_JOURNEY_REGISTRATION_ID", "PLAYER_JOURNEY_EXECUTION_STARTED_AT"].map((name) => [name, env[name]]));
  const currentCheckout = () => {
    checkConfigEnvironment(env);
    if (Object.entries(bindings).some(([name, value]) => env[name] !== value)) fail();
    const currentNga = checkout(ngaRoot, NGA); checkSource(currentNga, ngaPin);
    if (currentNga.branch !== initialNga.branch) fail("nga_hosted_source_refused");
    const currentLd = checkout(ldRoot, LD); checkSource(currentLd, ldPin);
    shared.guardHostedFixtureAuthority(authority, new Date(), currentLd);
    return currentLd;
  };
  const guard = () => { currentCheckout(); };
  const { createHostedFixtureController } = await import(pathToFileURL(join(ldRoot, "scripts/lib/player-journey-hosted-control.mjs")).href);
  const { DEFAULT_HOSTED_PROVIDER_STATE } = await import(pathToFileURL(join(ldRoot, "scripts/lib/player-journey-hosted-provider.mjs")).href);
  const control: Controller = createHostedFixtureController({ authority, currentCheckout, controlKey: required(env, "NGA_JOURNEY_FIXTURE_CONTROL_KEY") });
  const httpStatuses: number[] = [], boundaryViolations: string[] = [];
  const previewPaths = ["/api/coach/journey-preview", "/api/coach/journey-parent-capability", "/api/parent/journey-preview"];
  guard();
  const fullState = (): ClosedState => ({ ...DEFAULT_HOSTED_PROVIDER_STATE });
  async function post(request: APIRequestContext, path: string, data: object, extraHeaders: Record<string, string> = {}): Promise<APIResponse> {
    guard();
    if (!previewPaths.includes(path)) fail("nga_hosted_route_refused");
    try {
      const result = await request.post(`${origin}${path}`, { data, headers: { origin, ...extraHeaders }, maxRedirects: 0, timeout: 15000 });
      guard(); httpStatuses.push(result.status()); return result;
    } catch { return fail("nga_hosted_request_failed"); }
  }
  async function wire(context: BrowserContext) {
    context.on("response", (response) => { const url = new URL(response.url()); if (url.origin === origin && previewPaths.includes(url.pathname)) httpStatuses.push(response.status()); });
    await context.route("**/*", async (route) => {
      try {
        guard(); const url = new URL(route.request().url());
        if (url.origin !== origin || (!["GET", "HEAD"].includes(route.request().method()) && !previewPaths.includes(url.pathname))) {
          boundaryViolations.push("request_refused"); return await route.abort();
        }
        await route.continue();
      }
      catch { await route.abort().catch(() => undefined); }
    });
  }
  async function forward(route: Route, options: { lose?: boolean; hold?: Promise<void> } = {}) {
    try {
      guard(); if (new URL(route.request().url()).origin !== origin) fail();
      const result = await route.fetch({ maxRedirects: 0, timeout: 15000 });
      httpStatuses.push(result.status());
      guard(); if (options.hold) await options.hold;
      if (options.lose) await route.abort(); else await route.fulfill({ response: result });
    } catch { await route.abort().catch(() => undefined); }
  }
  async function barrier() {
    const id = randomUUID(); await control.arm("inventory", id);
    return {
      async blocked() {
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) { const receipt = await control.observe(); if ((receipt.barriers.inventory?.blocked ?? 0) > 0) return; await new Promise((done) => setTimeout(done, 50)); }
        fail("nga_hosted_barrier_unproven");
      },
      release: () => control.release("inventory", id),
    };
  }
  return { origin, playerId, registrationId, coachEmail, control, fullState, guard, post, wire, forward, barrier, proof,
    resetEvidence() { httpStatuses.length = 0; boundaryViolations.length = 0; },
    evidence() { return { http_statuses: [...httpStatuses], boundary_violations: boundaryViolations.length }; } };
}
export type HostedNgaAdapter = Awaited<ReturnType<typeof createHostedNgaAdapter>>;

export function coachCookie(email: string, key: string, expires = Math.floor(Date.now() / 1000) + 3600): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: expires })).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}
export function nearExpiryCode(code: string, key: string): { code: string; expires: number } {
  try {
    const claims = JSON.parse(Buffer.from(code.split(".")[1], "base64url").toString("utf8"));
    const expires = Math.floor(Date.now() / 1000) + 2;
    claims.issuedAt = expires - 600; claims.expiresAt = expires;
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return { code: `ngaj1.${payload}.${createHmac("sha256", key).update(`ngaj1.${payload}`).digest("base64url")}`, expires };
  } catch { return fail("nga_hosted_capability_refused"); }
}
export async function waitPast(expires: number): Promise<void> {
  const deadline = Date.now() + 4500;
  while (Math.floor(Date.now() / 1000) <= expires && Date.now() < deadline) await new Promise((done) => setTimeout(done, 25));
  if (Math.floor(Date.now() / 1000) <= expires) fail("nga_hosted_expiry_unproven");
}

export function privateOutput(path: string, ngaRoot: string): string {
  try {
    const info = lstatSync(path), child = relative(ngaRoot, path);
    if (!isAbsolute(path) || resolve(path) !== path || realpathSync(path) !== path || !info.isDirectory() ||
      info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0 || !(child === ".." || child.startsWith("../") || isAbsolute(child))) fail();
    return path;
  } catch { return fail("nga_hosted_output_refused"); }
}

/** Sole reporter: only constant test IDs, viewport and outcomes are retained.
 * Raw steps, assertion values, API errors, stdout/stderr and attachments never
 * enter output. Captures are disabled by the dedicated configuration. */
export default class HostedPrivacyReporter implements Reporter {
  private records: { id: string; title: string; viewport: string; status: string; retry: number; expected_status: string;
    started_at: string; duration_ms: number; evidence_path?: string; screenshot_path?: string }[] = [];
  private planned = 0;
  private reportPath?: string;
  private listing: boolean;
  private listed: { title: string; viewport: string }[] = [];
  private outputRoots: string[] = [];
  private settings = { retries: -1, repeat_each: -1, workers: -1, fully_parallel: true, forbid_only: false };
  constructor(options: { reportPath?: string; listing?: boolean } = {}) { this.reportPath = options.reportPath; this.listing = options.listing === true; }
  onBegin(config: FullConfig, suite: { allTests(): TestCase[] }) {
    const tests = suite.allTests(); this.planned = tests.length;
    this.listed = tests.map((test) => ({ title: HOSTED_STORIES.find((title) => title === test.title) ?? "unknown", viewport: test.parent.project()?.name ?? "unknown" }));
    this.outputRoots = config.projects.map((project) => project.outputDir);
    this.settings = { retries: config.projects.every((project) => project.retries === 0) ? 0 : -1,
      repeat_each: config.projects.every((project) => project.repeatEach === 1) ? 1 : -1,
      workers: config.workers, fully_parallel: config.fullyParallel, forbid_only: config.forbidOnly };
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const id = /^NGA-H\d{2}\b/.exec(test.title)?.[0] ?? "unknown";
    const viewport = test.parent.project()?.name ?? "unknown";
    const title = HOSTED_STORIES.find((title) => title === test.title) ?? "unknown";
    const owned = (name: string, basename: string) => {
      const path = result.attachments.find((a) => a.name === name)?.path;
      return path && isAbsolute(path) && resolve(path) === path && path.endsWith(`/${basename}`) &&
        this.outputRoots.some((root) => { const child = relative(root, path); return child !== "" && !child.startsWith("..") && !isAbsolute(child); }) ? path : undefined;
    };
    this.records.push({ id, title, viewport: ["desktop", "mobile"].includes(viewport) ? viewport : "unknown",
      status: test.annotations.some((annotation) => annotation.type === "hosted-private-failure") ? "failed" : result.status,
      retry: result.retry, expected_status: test.expectedStatus,
      started_at: result.startTime.toISOString(), duration_ms: result.duration,
      evidence_path: owned("hosted-safe-evidence", "hosted-safe-evidence.json"),
      screenshot_path: owned("hosted-safe-screenshot", "hosted-safe-view.png") });
  }
  onError() { /* Raw errors may contain credentials; final result fails below. */ }
  async onEnd(result: FullResult) {
    if (this.listing) {
      const valid = this.planned === 22 && this.listed.every((test) => test.title !== "unknown" && ["desktop", "mobile"].includes(test.viewport)) &&
        ["desktop", "mobile"].every((view) => new Set(this.listed.filter((t) => t.viewport === view).map((t) => t.title)).size === 11);
      for (const test of this.listed) process.stdout.write(`[${test.viewport}] ${test.title}\n`);
      process.stdout.write(`Total: ${this.planned} tests in 1 file. Discovery only; no provider requests.\n`);
      return { status: valid ? "passed" as const : "failed" as const };
    }
    let proof: Record<string, string | boolean> | undefined;
    for (const record of this.records) {
      try {
        const body = JSON.parse(readFileSync(record.evidence_path!, "utf8"));
        const picked = Object.fromEntries(["run_id", "owner_thread", "ld_commit", "nga_commit", "config_digest", "schema_digest", "provider_digest", "expires_at",
          "repository", "commit", "tree", "origin", "provider_origin", "provenance", "native_database_proven"].map((key) => [key, body[key]]));
        if (picked.repository !== NGA || !sha1.test(picked.commit) || !sha1.test(picked.tree) || !uuid.test(picked.owner_thread) ||
          !sha1.test(picked.ld_commit) || picked.nga_commit !== picked.commit ||
          [picked.config_digest, picked.schema_digest, picked.provider_digest].some((digest) => typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) ||
          typeof picked.expires_at !== "string" || picked.expires_at.length !== 24 || !Number.isFinite(Date.parse(picked.expires_at)) || new Date(picked.expires_at).toISOString() !== picked.expires_at ||
          typeof picked.run_id !== "string" || !/^[a-z][a-z0-9-]{7,39}$/.test(picked.run_id) || picked.origin !== `https://pj-${picked.run_id}-nga.vercel.app` ||
          !/^https:\/\/[a-z]{20}\.supabase\.co\/functions\/v1\/player-journey-fixture$/.test(picked.provider_origin) ||
          picked.provenance !== "hosted-next-ui-api-synthetic-notion-projection" || picked.native_database_proven !== false ||
          (proof && JSON.stringify(proof) !== JSON.stringify(picked))) { proof = undefined; break; }
        proof = picked;
      } catch { proof = undefined; break; }
    }
    const passed = result.status === "passed" && this.planned === 22 && this.records.length === 22 &&
      this.records.every((record) => record.id !== "unknown" && record.title !== "unknown" && record.status === "passed" && record.expected_status === "passed" && record.retry === 0 && record.viewport !== "unknown" && record.evidence_path && record.screenshot_path) && proof !== undefined &&
      this.settings.retries === 0 && this.settings.repeat_each === 1 && this.settings.workers === 1 && !this.settings.fully_parallel && this.settings.forbid_only &&
      ["desktop", "mobile"].every((view) => new Set(this.records.filter((r) => r.viewport === view).map((r) => r.id)).size === 11);
    const report = { stage: "hosted-synthetic-acceptance", passed, planned: this.planned, passed_cases: this.records.filter((r) => r.status === "passed").length,
      skipped: this.records.filter((r) => r.status === "skipped").length, flaky: this.records.filter((r) => r.status === "passed" && r.retry !== 0).length,
      unexpected: this.records.filter((r) => r.status !== "passed" && r.status !== "skipped").length, config: this.settings, proof, cases: this.records };
    if (this.reportPath) {
      let fd: number | undefined;
      try {
        const parent = lstatSync(dirname(this.reportPath));
        if (realpathSync(dirname(this.reportPath)) !== dirname(this.reportPath) || !parent.isDirectory() || parent.uid !== process.getuid?.() || (parent.mode & 0o077) !== 0 ||
          !isAbsolute(this.reportPath) || resolve(this.reportPath) !== this.reportPath) fail();
        fd = openSync(this.reportPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`);
      } catch { return fail("nga_hosted_report_refused"); }
      finally { if (fd !== undefined) closeSync(fd); }
    }
    process.stdout.write(`NGA hosted synthetic acceptance: ${report.passed_cases}/${this.planned}, skipped ${report.skipped}, ${passed ? "passed" : "failed"}.\n`);
    return { status: passed ? "passed" as const : "failed" as const };
  }
}
