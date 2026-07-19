import { test, expect } from "@playwright/test";
import { FetchStub } from "./fixtures/fetch-stub";

// Bracket assignment writes the coach-owned Level select on the Player CRM row.
// Invariants pinned here (minor-PII / Slop-Free — the bracket write is a NEW
// write path into a child-adjacent record):
//   1. It egresses ONLY to Notion — no third host ever sees the write.
//   2. On an existing row it PATCHes ONLY the Level property — coach-owned Site /
//      Skill Rating / Notes and every child field are never clobbered.
//   3. A bad level is rejected at the boundary with ZERO network calls.
//   4. Missing player identity is rejected with ZERO network calls.

process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_PLAYER_CRM_DB_ID = "player-crm-db";
delete process.env.NOTION_DB_ID;

import { setPlayerLevel } from "../src/lib/notion-player-bracket";

const ALLOWED_HOSTS = ["api.notion.com"];
const CHILD = "Ethan";
const EMAIL = "kathy@example.com";

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function armExistingRow() {
  stub
    .on("/databases/player-crm-db/query", { results: [{ id: "player-1" }] })
    .on("/pages/player-1", { id: "player-1" });
}

test.describe("bracket write — egress + write scope", () => {
  test("assigns a level touching only Notion", async () => {
    armExistingRow();
    const res = await setPlayerLevel({
      parentEmail: EMAIL,
      parentPhone: "",
      childFirstName: CHILD,
      level: "Green",
    });
    expect(res.ok).toBe(true);
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
    }
  });

  test("PATCH on an existing row writes ONLY the Level property", async () => {
    armExistingRow();
    await setPlayerLevel({
      parentEmail: EMAIL,
      parentPhone: "",
      childFirstName: CHILD,
      level: "Yellow",
    });
    const patch = stub.calls.find((c) => c.url.includes("/pages/player-1"));
    expect(patch, "expected a PATCH to the found player row").toBeTruthy();
    const body = JSON.parse(patch!.body) as { properties: Record<string, unknown> };
    expect(Object.keys(body.properties)).toEqual(["Level"]);
    expect(body.properties.Level).toEqual({ select: { name: "Yellow" } });
  });

  test("clearing the bracket sends select: null (no child fields)", async () => {
    armExistingRow();
    await setPlayerLevel({
      parentEmail: EMAIL,
      parentPhone: "",
      childFirstName: CHILD,
      level: null,
    });
    const patch = stub.calls.find((c) => c.url.includes("/pages/player-1"));
    const body = JSON.parse(patch!.body) as { properties: Record<string, unknown> };
    expect(Object.keys(body.properties)).toEqual(["Level"]);
    expect(body.properties.Level).toEqual({ select: null });
  });

  test("rejects an invalid level with ZERO network calls", async () => {
    const res = await setPlayerLevel({
      parentEmail: EMAIL,
      parentPhone: "",
      childFirstName: CHILD,
      // @ts-expect-error — deliberately invalid to prove the boundary check
      level: "Beginner",
    });
    expect(res.ok).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });

  test("rejects missing player identity with ZERO network calls", async () => {
    const res = await setPlayerLevel({
      parentEmail: "",
      parentPhone: "",
      childFirstName: CHILD,
      level: "Red",
    });
    expect(res.ok).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });
});
