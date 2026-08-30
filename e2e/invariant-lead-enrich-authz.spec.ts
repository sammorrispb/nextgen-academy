import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.NOTION_API_KEY = "ntn_test_enrichauthz";
process.env.NOTION_PLAYER_CRM_DB_ID = "enrich-authz-db";

import { POST as enrichPOST } from "../src/app/api/lead-enrich/route";

// THE gate on the enrichment surface. It writes to rows that carry child data,
// so the only acceptable failure mode is refusing. An UNSET secret must 401
// exactly like a wrong one — a surface that silently opens when someone forgets
// to set an env var is worse than one that never shipped.
const GOOD = "lead-enrich-secret-value";

function req(headers: Record<string, string>, body: unknown = validBody()) {
  return new NextRequest("https://nextgenpbacademy.com/api/lead-enrich", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function validBody(extra: Record<string, unknown> = {}) {
  return {
    parentEmail: "parent@enrichauthz.test",
    summary: "Wants a free eval; lives in Rockville; asked about privates first.",
    ...extra,
  };
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  process.env.LEAD_ENRICH_SECRET = GOOD;
});
test.afterEach(() => stub.uninstall());

test.describe("lead-enrich — authorization fails closed", () => {
  test("no Authorization header → 401", async () => {
    stub.install();
    const res = await enrichPOST(req({}));
    expect(res.status).toBe(401);
    expect(stub.calls, "an unauthorized call must not touch Notion").toHaveLength(0);
  });

  test("wrong bearer → 401", async () => {
    stub.install();
    const res = await enrichPOST(req({ authorization: "Bearer nope-not-it-at-all" }));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("UNSET secret → 401 even with a plausible token", async () => {
    delete process.env.LEAD_ENRICH_SECRET;
    stub.install();
    const res = await enrichPOST(req({ authorization: `Bearer ${GOOD}` }));
    expect(
      res.status,
      "an unset secret must fail closed, never open the surface",
    ).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("empty-string secret → 401", async () => {
    process.env.LEAD_ENRICH_SECRET = "";
    stub.install();
    const res = await enrichPOST(req({ authorization: "Bearer " }));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  test("correct bearer is accepted", async () => {
    stub.on("databases/enrich-authz-db/query", { results: [], has_more: false }).install();
    const res = await enrichPOST(req({ authorization: `Bearer ${GOOD}` }));
    expect(res.status).toBe(200);
  });

  test("dryRun writes NOTHING and returns the line it would append", async () => {
    stub.install();
    const res = await enrichPOST(
      req({ authorization: `Bearer ${GOOD}` }, validBody({ dryRun: true })),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wrote).toBe(false);
    expect(body.line).toContain("Email:");
    expect(stub.calls, "a dry run must not reach Notion at all").toHaveLength(0);
  });

  test("rejects a location outside the known areas", async () => {
    stub.install();
    const res = await enrichPOST(
      req(
        { authorization: `Bearer ${GOOD}` },
        validBody({ location: "Narnia" }),
      ),
    );
    expect(
      res.status,
      "an email parse must not invent a Notion select option",
    ).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });

  test("requires a contact and a summary", async () => {
    stub.install();
    expect((await enrichPOST(req({ authorization: `Bearer ${GOOD}` }, { summary: "hi" }))).status).toBe(400);
    expect(
      (await enrichPOST(req({ authorization: `Bearer ${GOOD}` }, { parentEmail: "a@b.co" }))).status,
    ).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
});
