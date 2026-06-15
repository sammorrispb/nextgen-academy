import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.ATTENDANCE_SECRET = "test-attendance-secret";
process.env.NOTION_API_KEY = "ntn_test_key";
process.env.NOTION_DROPINS_DB_ID = "db-dropins-test";
process.env.OPEN_BRAIN_INGEST_URL = "https://ob.test/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token";

import { POST as attendance } from "../src/app/api/attendance/route";

// The player profile DB id is hardcoded in notion-player-sync.ts (it is NOT the
// env dropins DB), so the spec must key on the literal to tell the player-sync
// query apart from the drop-in lookup query.
const PLAYER_DB = "1e5e34c258384c6cb5f3e846543ecfc7";
const DROPINS_DB = "db-dropins-test";
const OB = "ob.test/ingest";

function dropInRow(opts: {
  attendance?: "Present" | "No-show" | null;
  email?: string;
  phone?: string;
} = {}) {
  const sel = opts.attendance ? { select: { name: opts.attendance } } : { select: null };
  return {
    id: "dropin-page-1",
    properties: {
      "Parent Name": { rich_text: [{ plain_text: "Parent Test" }] },
      "Parent Email": { email: opts.email ?? "parent@test.com" },
      "Parent Phone": { phone_number: opts.phone ?? "" },
      "Child First Name": { rich_text: [{ plain_text: "Testkid" }] },
      "Child Birth Year": { number: 2016 },
      "Session Title": { rich_text: [{ plain_text: "Green Ball Drop-in" }] },
      "Session Date": { date: { start: "2026-06-20" } },
      "Session Start Time": { rich_text: [{ plain_text: "4:00 PM" }] },
      "Location": { rich_text: [{ plain_text: "Redland" }] },
      "Attendance": sel,
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_test" }] },
    },
  };
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/attendance", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-attendance-secret",
    },
  });
}

// Register the 5 fetch rules a full fan-out touches. Player-DB query rule is
// registered BEFORE the dropins-DB query rule (first-match-wins) so the two
// /databases/<id>/query calls resolve to the right shapes by their DB id.
function installFanout(row: ReturnType<typeof dropInRow>) {
  stub
    .on(`${PLAYER_DB}/query`, { results: [{ id: "player-row-1", properties: {} }] })
    .on(`${DROPINS_DB}/query`, { results: [row] })
    .on("api.notion.com/v1/pages/", { id: "patched" })
    .on(OB, { ok: true })
    .install();
}

// ── Discriminators: the 3 UI-action triggers, pinned independently ──
// A) attendance write   = PATCH /v1/pages/ whose body sets the Attendance select
// B) recompute query    = a call to the hardcoded PLAYER_DB query endpoint
// C) recompute write    = PATCH /v1/pages/ whose body sets "Attendance Count"
// D) OB ingest          = a call to the OB url carrying source nga_attendance
const attendanceWrites = () =>
  stub.callsTo("/v1/pages/").filter((c) => c.body.includes('"Attendance"'));
const playerQueries = () => stub.callsTo(`${PLAYER_DB}/query`);
const playerWrites = () =>
  stub.callsTo("/v1/pages/").filter((c) => c.body.includes("Attendance Count"));
const obIngests = () =>
  stub.callsTo(OB).filter((c) => c.body.includes("nga_attendance"));

test.describe("mark-attendance fan-out parity (agent route == UI action)", () => {
  test("Present → all 3 triggers + OB ingest fire", async () => {
    installFanout(dropInRow());
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "Present" }));
    expect(res.status).toBe(200);

    // A) attendance written as Present
    const aw = attendanceWrites();
    expect(aw).toHaveLength(1);
    expect(aw[0].body).toContain('"Present"');
    // B) recompute queried the player DB
    expect(playerQueries()).toHaveLength(1);
    // C) recompute wrote the player stat row
    expect(playerWrites()).toHaveLength(1);
    // D) OB ingest fired with the attendance source + value
    const ob = obIngests();
    expect(ob).toHaveLength(1);
    expect(ob[0].body).toContain('"attendance":"Present"');

    const ack = JSON.stringify(await res.json());
    expect(ack).toContain('"status":"Present"');
  });

  test("No-show → OB ingest carries No-show", async () => {
    installFanout(dropInRow());
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "No-show" }));
    expect(res.status).toBe(200);
    expect(attendanceWrites()).toHaveLength(1);
    expect(obIngests()[0].body).toContain('"attendance":"No-show"');
    expect(playerWrites()).toHaveLength(1);
  });

  test("clear → attendance cleared + recompute fires, NO OB ingest", async () => {
    installFanout(dropInRow({ attendance: "Present" }));
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "clear" }));
    expect(res.status).toBe(200);
    // attendance PATCH fired, setting the select to null (no "Present" in body)
    const aw = attendanceWrites();
    expect(aw).toHaveLength(1);
    expect(aw[0].body).toContain('"select":null');
    // recompute still runs on a clear (stats must drop the removed check-in)
    expect(playerWrites()).toHaveLength(1);
    // but NO OB activity for a cleared value
    expect(obIngests()).toHaveLength(0);
    const ack = JSON.stringify(await res.json());
    expect(ack).toContain('"status":"cleared"');
  });

  test("no parent email AND no phone → write only, no OB, no player query", async () => {
    installFanout(dropInRow({ email: "", phone: "" }));
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "Present" }));
    expect(res.status).toBe(200);
    expect(attendanceWrites()).toHaveLength(1);
    expect(obIngests()).toHaveLength(0);
    expect(playerQueries()).toHaveLength(0);
  });

  test("idempotent re-fire (same value) → no write, no OB, no recompute", async () => {
    installFanout(dropInRow({ attendance: "Present" }));
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "Present" }));
    expect(res.status).toBe(200);
    expect(attendanceWrites()).toHaveLength(0);
    expect(playerQueries()).toHaveLength(0);
    expect(obIngests()).toHaveLength(0);
    const ack = JSON.stringify(await res.json());
    expect(ack).toContain('"idempotent":true');
  });

  test("not-found drop-in → 404, no PATCH", async () => {
    stub.on(`${DROPINS_DB}/query`, { results: [] }).install();
    const res = await attendance(req({ checkoutSessionId: "cs_missing", attended: "Present" }));
    expect(res.status).toBe(404);
    expect(stub.callsTo("/v1/pages/")).toHaveLength(0);
  });

  test("attendance write fails → 500, no OB, no recompute after", async () => {
    stub
      .on(`${DROPINS_DB}/query`, { results: [dropInRow()] })
      .on("api.notion.com/v1/pages/", { error: "boom" }, 500)
      .on(OB, { ok: true })
      .install();
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "Present" }));
    expect(res.status).toBe(500);
    expect(obIngests()).toHaveLength(0);
    expect(playerQueries()).toHaveLength(0);
  });

  test("missing checkoutSessionId → 400, zero downstream calls", async () => {
    stub.install();
    const res = await attendance(req({ attended: "Present" }));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });

  test("invalid attended value → 400, zero downstream calls", async () => {
    stub.install();
    const res = await attendance(req({ checkoutSessionId: "cs_test", attended: "maybe" }));
    expect(res.status).toBe(400);
    expect(stub.calls.length).toBe(0);
  });
});
