import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// The top-nav family search endpoint returns child names — a coach-scoped
// minor-PII surface. Invariant: with NO valid coach session it fails closed
// (401) and makes ZERO Notion calls, so child data never egresses without coach
// auth. (The positive path's minimal-fields projection is pinned by the
// toSearchIndex test in player-profiles.spec.ts; the gate composition by
// invariant-coach-session-scope.spec.ts.)

process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_DROPINS_DB_ID = "dropins-db";
// No COACH cookie can exist in a bare route invocation → requireCoach yields
// null → the route must 401 before any fetch.

import { GET } from "../src/app/api/coach/family-search/route";

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

test.describe("coach family-search — fails closed", () => {
  test("no coach session → 401 and zero Notion egress", async () => {
    // Arm the DB query so that IF the route ever queried Notion the call would
    // succeed — the assertion is that it never does.
    stub.on("/databases/dropins-db/query", { results: [] });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);

    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("childNames");
  });
});
