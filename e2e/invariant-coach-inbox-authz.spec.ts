import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE import (read at call time; pattern matches sibling specs).
process.env.NOTION_API_KEY = "test-notion-key-inbox";

import { setDraftStatus } from "../src/lib/notion-newsletter-drafts";

// Coach Inbox (Phase 1b) invariants. The inbox's server actions flip Notion
// statuses that gate PARENT-FACING sends (news + newsletter-draft approval
// feed the Thursday broadcast) and re-arm an OFF-SESSION CARD CHARGE
// (CardFailed → Active re-enters the crew-autoreserve charge loop), so:
//
//   1. every action sits behind the ONE shared requireCoach gate
//      (cookie composition itself is pinned by
//      invariant-coach-session-scope.spec.ts — these are the wiring pins,
//      same technique as invariant-ops-live-send-authz.spec.ts);
//   2. draft approval is approval of READ content — setDraftStatus refuses
//      to approve a row whose rendered body is empty, and the approve
//      button only renders inside the card that displays the body;
//   3. no auto-approve path exists — the weekly-newsletter cron never
//      imports the draft status setter;
//   4. re-activating a CardFailed commit requires an explicit confirm and
//      the UI copy states the stored-card charge will retry.
//
// Mutation checks: (a) drop the requireCoach call from any action → the
// per-action gate pin fails; (b) remove the isDraftBodyApprovable guard from
// setDraftStatus → the approve-gate pin fails; (c) make reactivate skip the
// confirmed check → the confirm pins fail.

const read = (...parts: string[]) =>
  readFileSync(join(__dirname, "..", ...parts), "utf8");

const actionsSrc = () =>
  read("src", "app", "coach", "(authed)", "inbox", "actions.ts");
const rowsSrc = () =>
  read("src", "app", "coach", "(authed)", "inbox", "InboxRows.tsx");
const pageSrc = () =>
  read("src", "app", "coach", "(authed)", "inbox", "page.tsx");
const draftsLibSrc = () => read("src", "lib", "notion-newsletter-drafts.ts");

test.describe("inbox actions are coach-gated (wiring pins)", () => {
  test("actions use the ONE shared requireCoach (no local copy)", () => {
    const src = actionsSrc();
    expect(src).toContain('from "@/lib/coach-auth-server"');
    expect(src).not.toMatch(/async function requireCoach/);
  });

  test("every exported action awaits requireCoach and fails closed", () => {
    const src = actionsSrc();
    const exported = src.match(/export async function \w+Action/g) ?? [];
    expect(exported.length).toBeGreaterThanOrEqual(5);
    const gates = src.match(/await requireCoach\(\)/g) ?? [];
    expect(
      gates.length,
      "each exported action must call requireCoach()",
    ).toBeGreaterThanOrEqual(exported.length);
    const denials = src.match(/if \(!email\) return UNAUTHORIZED/g) ?? [];
    expect(
      denials.length,
      "each exported action must return the unauthorized result on a null gate",
    ).toBeGreaterThanOrEqual(exported.length);
  });

  test("actions write ONLY through the vetted libs — no raw Notion calls", () => {
    const src = actionsSrc();
    expect(src).not.toContain("api.notion.com");
    // and only vocabulary-pinned decisions, via the shared maps:
    expect(src).toContain('from "@/lib/coach-inbox"');
    expect(src).toContain("NEWS_DECISION_TO_STATUS");
    expect(src).toContain("CREW_DECISION_TO_STATUS");
    expect(src).toContain("DRAFT_DECISION_TO_STATUS");
  });
});

test.describe("newsletter approve gate — approval is approval of READ content", () => {
  test("setDraftStatus refuses to approve an empty rendered body (guard precedes the PATCH)", () => {
    const src = draftsLibSrc();
    const fnStart = src.indexOf("export async function setDraftStatus");
    expect(fnStart, "setDraftStatus must exist").toBeGreaterThan(-1);
    const body = src.slice(fnStart);
    const guardAt = body.indexOf("isDraftBodyApprovable(");
    const patchAt = body.indexOf('method: "PATCH"');
    expect(guardAt, "approve path must render + check the body").toBeGreaterThan(-1);
    expect(patchAt).toBeGreaterThan(-1);
    expect(guardAt, "body check must run BEFORE the status write").toBeLessThan(
      patchAt,
    );
  });

  test("the approve action goes through setDraftStatus (no direct status write)", () => {
    const src = actionsSrc();
    expect(src).toContain("setDraftStatus(");
  });

  test("no auto-approve path: the weekly-newsletter cron never imports the draft status setter", () => {
    const cron = read("src", "app", "api", "cron", "weekly-newsletter", "route.ts");
    expect(cron).not.toContain("setDraftStatus");
  });

  test("the approve button renders only inside the card that displays the draft body", () => {
    // The page hands each draft's rendered html to the SAME component that
    // owns the approve action — there is no approve affordance outside it.
    const rows = rowsSrc();
    const page = pageSrc();
    expect(rows).toContain("dangerouslySetInnerHTML");
    expect(rows).toContain("approveDraftAction");
    expect(page).not.toContain("approveDraftAction");
  });
});

// Behavioral (offline, FetchStub): the approve gate must actually STOP the
// status write, not just exist in the source — a neutered guard (e.g.
// `if (false && …)`) passes a source pin but fails these.
test.describe("setDraftStatus behavior — the approve gate stops the write", () => {
  const stub = new FetchStub();
  test.beforeEach(() => {
    stub.reset();
    stub.install();
  });
  test.afterEach(() => stub.uninstall());

  const paragraph = (text: string) => ({
    type: "paragraph",
    paragraph: { rich_text: [{ plain_text: text }] },
  });

  test("approving a row whose body renders EMPTY refuses and never PATCHes", async () => {
    stub.on("/blocks/", { results: [] });
    stub.on("/pages/", {}); // must never be hit
    const r = await setDraftStatus("row-empty", "Approved");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("nothing to approve");
    expect(stub.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  test("an unreadable body (blocks fetch error) refuses — never approve unread content", async () => {
    stub.on("/blocks/", { error: "boom" }, 500);
    stub.on("/pages/", {});
    const r = await setDraftStatus("row-unreadable", "Approved");
    expect(r.ok).toBe(false);
    expect(stub.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  test("approving a row with real rendered content PATCHes Status=Approved", async () => {
    stub.on("/blocks/", { results: [paragraph("Hi parents — this week…")] });
    stub.on("/pages/", {});
    const r = await setDraftStatus("row-good", "Approved");
    expect(r.ok).toBe(true);
    const patches = stub.calls.filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toContain('"Approved"');
  });

  test("Skip writes without a body read (nothing is being shipped)", async () => {
    stub.on("/pages/", {});
    const r = await setDraftStatus("row-skip", "Skip");
    expect(r.ok).toBe(true);
    expect(stub.callsTo("/blocks/")).toHaveLength(0);
    const patches = stub.calls.filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toContain('"Skip"');
  });
});

test.describe("CardFailed re-activation — one informed tap, never automatic", () => {
  test("the server action requires an explicit confirmed flag before updateCommit", () => {
    const src = actionsSrc();
    const fnStart = src.indexOf("export async function reactivateCommitAction");
    expect(fnStart).toBeGreaterThan(-1);
    const body = src.slice(fnStart);
    const confirmAt = body.search(/confirmed !== true/);
    const commitAt = body.indexOf("updateCommit(");
    expect(confirmAt, "action must refuse without confirmed: true").toBeGreaterThan(-1);
    expect(commitAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeLessThan(commitAt);
  });

  test("re-activation flips status to Active only — no retry loop, no charge call here", () => {
    const src = actionsSrc();
    expect(src).toMatch(/status:\s*"Active"/);
    expect(src).not.toContain("stripe");
    expect(src).not.toContain("paymentIntents");
  });

  test("button copy states the stored-card charge retries on the next autoreserve run, behind a confirm step", () => {
    const rows = rowsSrc();
    expect(rows).toMatch(/stored card/i);
    expect(rows).toMatch(/autoreserve/i);
    expect(rows).toContain("reactivateCommitAction");
    expect(rows).toMatch(/confirmed:\s*true/);
  });
});
