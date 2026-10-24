import { test, expect } from "@playwright/test";
import type { FullConfig, TestCase, TestResult } from "@playwright/test/reporter";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import Reporter, { HOSTED_STORIES, checkConfigEnvironment, checkSource, clearPrivateFailure, coachCookie, createHostedNgaAdapter,
  hostedCasesEnabled, nearExpiryCode, privateOutput, classifyHostedBrowserRequest, validateHostedAnalyticsNoop, advanceHostedAuxiliary, createHostedAuxiliaryLedger, type Checkout } from "./fixtures/player-journey-hosted-adapter";
import { verifySessionCookieValue } from "../src/lib/coach-auth";
import { issueParentPreviewCode, verifyParentPreviewCode } from "../src/lib/nga-parent-preview";

const ld = "https://github.com/sammorrispb/community-os.git", nga = "https://github.com/sammorrispb/nextgen-academy.git";
const pin = { repository: nga, commit: "a".repeat(40), tree: "b".repeat(40) };
const source: Checkout = { ...pin, branch: "codex/synthetic-source", status: "" };
const key = "synthetic_signing_secret_for_offline_helper_only";
function environment() {
  return { NGA_HOSTED_ACCEPTANCE: "1", PLAYER_JOURNEY_HOSTED_FIXTURES: "1", PLAYWRIGHT_BASE_URL: "https://pj-synthetic-test-nga.vercel.app",
    PLAYER_JOURNEY_LD_CHECKOUT: "/nonexistent/synthetic", PLAYER_JOURNEY_LD_COMMIT: "a".repeat(40), PLAYER_JOURNEY_LD_TREE: "b".repeat(40),
    PLAYER_JOURNEY_NGA_COMMIT: "c".repeat(40), PLAYER_JOURNEY_NGA_TREE: "d".repeat(40),
    PLAYER_JOURNEY_HOSTED_ADMISSION_PATH: "/nonexistent/metadata.json", PLAYER_JOURNEY_HOSTED_ADMISSION_SHA256: "e".repeat(64),
    NGA_JOURNEY_FIXTURE_CONTROL_KEY: "synthetic_control_key_for_offline_helper_only", COACH_SIGNING_SECRET: key,
    NGA_JOURNEY_PREVIEW_SIGNING_SECRET: `${key}_separate`, COACH_ALLOWED_EMAILS: "synthetic-coach@example.invalid",
    NGA_JOURNEY_PLAYER_ID: "00000000-0000-4000-8000-000000000001", NGA_JOURNEY_REGISTRATION_ID: "00000000-0000-4000-8000-000000000004",
    NGA_HOSTED_OUTPUT_DIR: "/nonexistent/output", PLAYER_JOURNEY_HOSTED_REPORT_PATH: "/nonexistent/report.json" };
}
async function temporary(work: (root: string) => unknown) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "nga-hosted-pure-"));
  try { await work(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("hosted adapter registers no ordinary cases and rejects malformed or partial dedicated modes", () => {
  expect(hostedCasesEnabled({})).toBe(false);
  for (const flag of ["0", "true", ""]) expect(() => hostedCasesEnabled({ NGA_HOSTED_ACCEPTANCE: flag })).toThrow("nga_hosted_admission_refused");
  const env = environment(); expect(checkConfigEnvironment(env)).toBe(env.PLAYWRIGHT_BASE_URL);
  expect(checkConfigEnvironment({ NGA_HOSTED_ACCEPTANCE: "1", PLAYER_JOURNEY_HOSTED_FIXTURES: "1", PLAYWRIGHT_BASE_URL: env.PLAYWRIGHT_BASE_URL }, true)).toBe(env.PLAYWRIGHT_BASE_URL);
  for (const change of [{ PLAYER_JOURNEY_HOSTED_FIXTURES: "0" }, { PLAYER_JOURNEY_LD_TREE: "" }, { PLAYWRIGHT_BASE_URL: "https://nextgenpbacademy.com" },
    { NODE_OPTIONS: "--import=untrusted" }, { NGA_SYNTHETIC_JOURNEY_STATE: "/synthetic/local-file" }, { LD_SESSION_STAGING: "1" },
    { PLAYER_JOURNEY_EXECUTION_STARTED_AT: "true" }, { PLAYER_JOURNEY_EXECUTION_STARTED_AT: "2099-01-01T00:00:00.000Z" }])
    expect(() => checkConfigEnvironment({ ...env, ...change })).toThrow("nga_hosted_admission_refused");
});

test("independent NGA checkout requires the exact committed source, clean status and nonmain branch", () => {
  checkSource(source, pin);
  for (const change of [{ repository: ld }, { commit: "f".repeat(40) }, { tree: "f".repeat(40) }, { branch: "main" }, { branch: "HEAD" }, { status: "?? adapter.ts\n" }, { status: " " }])
    expect(() => checkSource({ ...source, ...change }, pin)).toThrow("nga_hosted_source_refused");
});

test("unadmitted shared checkout fails before dynamic module execution or provider access", async () => temporary(async (root) => {
  mkdirSync(join(root, "scripts", "lib"), { recursive: true });
  const marker = join(root, "must-not-exist");
  writeFileSync(join(root, "scripts", "lib", "player-journey-hosted-fixtures.mjs"), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)},'executed'); throw new Error('untrusted-module-executed');`);
  let message = "";
  try { await createHostedNgaAdapter(root, { ...environment(), PLAYER_JOURNEY_LD_CHECKOUT: root }); }
  catch (error) { message = error instanceof Error ? error.message : "unexpected"; }
  expect(message).toBe("nga_hosted_source_refused"); expect(existsSync(marker)).toBe(false);
}));

test("private output accepts only owned canonical directories outside source", async () => temporary((root) => {
  const repo = join(root, "repo"), output = join(root, "output"); mkdirSync(repo, { mode: 0o700 }); mkdirSync(output, { mode: 0o700 });
  expect(privateOutput(output, repo)).toBe(output);
  expect(() => privateOutput(repo, repo)).toThrow("nga_hosted_output_refused");
  const misleading = join(repo, "..output"); mkdirSync(misleading, { mode: 0o700 });
  expect(() => privateOutput(misleading, repo)).toThrow("nga_hosted_output_refused");
  symlinkSync(output, join(root, "link"));
  expect(() => privateOutput(join(root, "link"), repo)).toThrow("nga_hosted_output_refused");
}));

test("synthetic coach cookie uses the actual existing verifier and distinct wrong keys fail", () => {
  const old = process.env.COACH_SIGNING_SECRET;
  try {
    process.env.COACH_SIGNING_SECRET = key;
    expect(verifySessionCookieValue(coachCookie("synthetic-coach@example.invalid", key)) === "synthetic-coach@example.invalid").toBe(true);
    expect(verifySessionCookieValue(coachCookie("synthetic-coach@example.invalid", `${key}_wrong`)) === null).toBe(true);
    expect(verifySessionCookieValue(coachCookie("synthetic-coach@example.invalid", key, 1)) === null).toBe(true);
  } finally { if (old === undefined) delete process.env.COACH_SIGNING_SECRET; else process.env.COACH_SIGNING_SECRET = old; }
});

test("near-expiry parent code retains actual purpose/scope validation and expires on the canonical verifier", () => {
  const previous = { key: process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET, coaches: process.env.COACH_ALLOWED_EMAILS };
  try {
    process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = key; process.env.COACH_ALLOWED_EMAILS = "synthetic-coach@example.invalid";
    const code = issueParentPreviewCode({ playerId: "00000000-0000-4000-8000-000000000001", registrationId: "00000000-0000-4000-8000-000000000004",
      assessmentRevision: "a".repeat(64), registrationRevision: "b".repeat(64), identityRevision: "c".repeat(64), focusId: "skill-6" }, "synthetic-coach@example.invalid");
    expect(typeof code === "string").toBe(true);
    const short = nearExpiryCode(code!, key);
    expect(verifyParentPreviewCode(short.code) !== null).toBe(true);
    expect(verifyParentPreviewCode(short.code, short.expires * 1000) === null).toBe(true);
    expect(verifyParentPreviewCode(nearExpiryCode(code!, `${key}_wrong`).code) === null).toBe(true);
  } finally {
    if (previous.key === undefined) delete process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET; else process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET = previous.key;
    if (previous.coaches === undefined) delete process.env.COACH_ALLOWED_EMAILS; else process.env.COACH_ALLOWED_EMAILS = previous.coaches;
  }
});

test("sole hosted reporter drops raw credential-bearing errors, steps, stdout and attachments", async () => temporary(async (root) => {
  const reportPath = join(root, "report.json"), auxiliaryRoot = join(root, "output"), outputDir = join(auxiliaryRoot, "playwright"); mkdirSync(auxiliaryRoot, { mode: 0o700 }); mkdirSync(outputDir, { mode: 0o700 });
  const reporter = new Reporter({ reportPath });
  const proof = { run_id: "synthetic-test", owner_thread: "01a16b03-1a0c-7203-8da3-2312df3280bf", ...pin,
    ld_commit: "e".repeat(40), nga_commit: pin.commit, config_digest: "f".repeat(64), schema_digest: "1".repeat(64), provider_digest: "2".repeat(64), expires_at: "2026-10-24T10:00:00.000Z",
    origin: "https://pj-synthetic-test-nga.vercel.app", provider_origin: "https://abcdefghijklmnopqrst.supabase.co/functions/v1/player-journey-fixture",
    provenance: "hosted-next-ui-api-synthetic-notion-projection", native_database_proven: false };
  createHostedAuxiliaryLedger(auxiliaryRoot, { run_id: proof.run_id, ld_commit: proof.ld_commit, nga_commit: proof.nga_commit });
  const tests = ["desktop", "mobile"].flatMap((view) => HOSTED_STORIES.map((title) => ({ title, expectedStatus: "passed", annotations: [], parent: { project: () => ({ name: view }) } } as unknown as TestCase)));
  reporter.onBegin({ projects: [{ retries: 0, repeatEach: 1, outputDir }, { retries: 0, repeatEach: 1, outputDir }], workers: 1, fullyParallel: false, forbidOnly: true } as FullConfig, { allTests: () => tests });
  const credential = "ngaj1.synthetic-private-report-probe.synthetic-signature";
  for (const [index, testCase] of tests.entries()) {
    const dir = join(outputDir, String(index)); mkdirSync(dir, { mode: 0o700 });
    const evidence = join(dir, "hosted-safe-evidence.json"), png = join(dir, "hosted-safe-view.png");
    writeFileSync(evidence, JSON.stringify({ ...proof, actual: { auxiliary: { analytics_noop_statuses: [], blocked_prefetches: 0 } } }), { mode: 0o600 });
    reporter.onTestEnd(testCase, { status: "passed", retry: 0, startTime: new Date(), duration: 1, errors: [{ message: credential }], stdout: [credential], stderr: [credential], steps: [{ title: credential }],
      attachments: [{ name: "hosted-safe-evidence", path: evidence }, { name: "hosted-safe-screenshot", path: png }, { name: "raw-private", body: Buffer.from(credential) }] } as unknown as TestResult);
  }
  const originalWrite = process.stdout.write, output: string[] = [];
  try {
    process.stdout.write = ((chunk: unknown) => { output.push(String(chunk)); return true; }) as typeof process.stdout.write;
    expect(await reporter.onEnd({ status: "passed", startTime: new Date(), duration: 1 })).toEqual({ status: "passed" });
  } finally { process.stdout.write = originalWrite; }
  expect(output.every((value) => !value.includes(credential))).toBe(true);
  const report = readFileSync(reportPath, "utf8"); expect(report.includes(credential)).toBe(false);
  const value = JSON.parse(report); expect(value.passed_cases).toBe(22); expect(value.skipped).toBe(0); expect(value.flaky).toBe(0);
  expect(value.proof).toEqual(proof);
  expect(value.auxiliary).toEqual({ analytics_noop_calls: 0, analytics_noop_limit: 32, blocked_prefetches: 0, blocked_prefetch_limit: 64 });
  expect(value.config).toEqual({ retries: 0, repeat_each: 1, workers: 1, fully_parallel: false, forbid_only: true });
  expect(value.cases.every((record: object) => !Object.hasOwn(record, "errors") && !Object.hasOwn(record, "steps"))).toBe(true);
}));

test("worker failure guard prevents the pinned error-context builder's first credential write without hiding failure", () => {
  const require = createRequire(__filename);
  const { buildErrorContext } = require(join(dirname(require.resolve("playwright/package.json")), "lib/errorContext.js")) as {
    buildErrorContext(options: { titlePath: string[]; location: { file: string; line: number; column: number }; errors: { message: string }[]; pageSnapshot?: string }): string | undefined;
  };
  const credential = "ngaj1.synthetic-error-context-probe.synthetic-signature";
  const info = { errors: [{ message: credential }], status: "failed", annotations: [] as { type: string; description?: string }[] };
  const options = { titlePath: ["synthetic guard regression"], location: { file: __filename, line: 1, column: 1 }, errors: info.errors };
  expect(buildErrorContext(options)?.includes(credential)).toBe(true);
  clearPrivateFailure(info);
  expect(buildErrorContext({ ...options, errors: info.errors })).toBeUndefined();
  expect(info.status).toBe("failed"); expect(info.annotations).toEqual([{ type: "hosted-private-failure", description: "assertion-or-transport-failed" }]);
});


test("hosted browser policy permits only fixed local assets and exact coach analytics", () => {
  const origin = environment().PLAYWRIGHT_BASE_URL;
  const request = { origin, url: `${origin}/api/analytics`, method: "POST", frameUrl: `${origin}/coach/journey`,
    headers: { "content-type": "application/json", referer: `${origin}/coach/journey` },
    body: JSON.stringify({ event_name: "page_view", page: "/coach/journey", props: { referrer: "", visitor_id: "00000000-0000-4000-8000-000000000001", business: "nga" } }) };
  expect(classifyHostedBrowserRequest(request)).toBe("analytics-noop");
  for (const change of [{ frameUrl: `${origin}/parent/next` }, { url: "https://nextgenpbacademy.com/api/analytics" }, { method: "GET" },
    { body: request.body.replace('"page_view"', '"cta_click"') }, { body: request.body.replace('"referrer":""', '"referrer":"https://foreign.invalid"') },
    { body: request.body.replace('"business":"nga"', '"business":"nga","code":"private"') },
    { body: request.body.replace('"business":"nga"', '"business":"nga","child":"private"') }, { body: "x".repeat(2049) }])
    expect(classifyHostedBrowserRequest({ ...request, ...change })).toBe("refuse");
  for (const path of ["/images/og-image.png", "/favicon.ico", "/_next/static/chunks/synthetic.js", "/_next/image?url=%2Fimages%2Flogo.png&w=384&q=75"])
    expect(classifyHostedBrowserRequest({ ...request, method: "GET", url: `${origin}${path}`, body: null })).toBe("static");
  for (const path of ["/_next/image?url=https%3A%2F%2Fforeign.invalid%2Fchild.png&w=384&q=75", "/images/foreign.png", "/api/lead", "/_next/anything", "/coach/journey?code=private"])
    expect(classifyHostedBrowserRequest({ ...request, method: "GET", url: `${origin}${path}`, body: null })).toBe("refuse");
  expect(() => checkConfigEnvironment({ ...environment(), OPEN_BRAIN_ANALYTICS_URL: "https://foreign.invalid" })).toThrow("nga_hosted_admission_refused");
  expect(() => checkConfigEnvironment({ ...environment(), LEAD_INGEST_TOKEN: "synthetic-private" })).toThrow("nga_hosted_admission_refused");
});

test("only source-owned Next prefetch is aborted as bounded auxiliary work", () => {
  const origin = environment().PLAYWRIGHT_BASE_URL;
  const request = { origin, url: `${origin}/schedule?_rsc=abc123`, method: "GET", frameUrl: `${origin}/coach/journey`,
    headers: { "next-router-prefetch": "1", rsc: "1" }, body: null };
  expect(classifyHostedBrowserRequest(request)).toBe("blocked-prefetch");
  for (const change of [{ headers: {} }, { headers: { "next-router-prefetch": "0", rsc: "1" } }, { method: "POST" },
    { url: `${origin}/api/lead?_rsc=abc123` }, { url: `${origin}/schedule?code=private` }, { frameUrl: `${origin}/foreign` },
    { url: "https://foreign.invalid/schedule?_rsc=abc123" }])
    expect(classifyHostedBrowserRequest({ ...request, ...change })).toBe("refuse");
  expect(classifyHostedBrowserRequest({ ...request, url: `${origin}/coach/journey`, headers: {} })).toBe("page");
  expect(classifyHostedBrowserRequest({ ...request, method: "POST", url: `${origin}/api/coach/journey-preview`, headers: {} })).toBe("preview");
});

test("auxiliary receipts require real empty 204 responses and hard phase bounds", () => {
  expect(() => validateHostedAnalyticsNoop(204, Buffer.alloc(0))).not.toThrow();
  for (const [status, body] of [[200, Buffer.alloc(0)], [204, Buffer.from("private")], [302, Buffer.alloc(0)]] as const)
    expect(() => validateHostedAnalyticsNoop(status, body)).toThrow("nga_hosted_auxiliary_refused");
  expect(advanceHostedAuxiliary({ analytics_noop_calls: 31, blocked_prefetches: 63 }, "analytics-noop")).toEqual({ analytics_noop_calls: 32, blocked_prefetches: 63 });
  expect(advanceHostedAuxiliary({ analytics_noop_calls: 32, blocked_prefetches: 63 }, "blocked-prefetch")).toEqual({ analytics_noop_calls: 32, blocked_prefetches: 64 });
  for (const [counts, kind] of [[{ analytics_noop_calls: 32, blocked_prefetches: 0 }, "analytics-noop"], [{ analytics_noop_calls: 0, blocked_prefetches: 64 }, "blocked-prefetch"],
    [{ analytics_noop_calls: -1, blocked_prefetches: 0 }, "analytics-noop"]] as const)
    expect(() => advanceHostedAuxiliary(counts, kind)).toThrow("nga_hosted_auxiliary_refused");
});


test("private phase ledger persists across workers and refuses replacement, foreign pins and capacity overflow", async () => temporary(root => {
  const pins = { run_id: "synthetic-test", ld_commit: "a".repeat(40), nga_commit: "b".repeat(40) };
  const first = createHostedAuxiliaryLedger(root, pins);
  first.reserve("analytics-noop"); first.reserve("blocked-prefetch");
  const second = createHostedAuxiliaryLedger(root, pins);
  expect(second.snapshot()).toEqual({ analytics_noop_calls: 1, blocked_prefetches: 1 });
  expect(() => createHostedAuxiliaryLedger(root, { ...pins, nga_commit: "c".repeat(40) }).snapshot()).toThrow("nga_hosted_auxiliary_refused");
  for (let index = 1; index < 32; index++) second.reserve("analytics-noop");
  expect(() => first.reserve("analytics-noop")).toThrow("nga_hosted_auxiliary_refused");
  expect(second.snapshot()).toEqual({ analytics_noop_calls: 32, blocked_prefetches: 1 });
  const serialized = readFileSync(join(root, "nga-hosted-auxiliary.json"), "utf8");
  expect(Object.keys(JSON.parse(serialized)).sort()).toEqual(["counts", "ld_commit", "nga_commit", "run_id"]);
  writeFileSync(join(root, "nga-hosted-auxiliary.lock"), "", { mode: 0o600 });
  expect(() => second.reserve("blocked-prefetch")).toThrow("nga_hosted_auxiliary_refused");
  expect(readFileSync(join(root, "nga-hosted-auxiliary.json"), "utf8")).toBe(serialized);
  rmSync(join(root, "nga-hosted-auxiliary.lock"));
  rmSync(join(root, "nga-hosted-auxiliary.json"));
  symlinkSync(join(root, "outside"), join(root, "nga-hosted-auxiliary.json"));
  expect(() => second.snapshot()).toThrow("nga_hosted_auxiliary_refused");
}));
