import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";
import { POST } from "../src/app/api/lesson-scheduling/route";

const SECRET = "lesson-scheduling-test-secret-at-least-32-chars";
const stub = new FetchStub();
const valid = {
  action: "prepare_request", requestId: "562a781f-812d-4663-a906-e9940bd788ec",
  parentName: "Parent Example", parentEmail: "Parent@Example.org",
  parentPhone: "+13015550123", partySize: 2,
};
const waiver = { id: "waiver", properties: {
  "Parent Email": { email: "PARENT@example.org" },
  "Signature Name": { rich_text: [{ plain_text: "Parent Example" }] },
  "Signed At": { date: { start: "2026-09-01T12:00:00Z" } },
  "Waiver Version": { rich_text: [{ plain_text: "2026-06" }] },
} };
function request(body: unknown = valid, authorization = `Bearer ${SECRET}`) {
  return new NextRequest("https://nextgenpbacademy.com/api/lesson-scheduling", {
    method: "POST", headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body),
  });
}
function signed() {
  stub.on("databases/waivers/query", { results: [waiver], has_more: false });
}
test.beforeEach(() => {
  process.env.NGA_LESSON_SCHEDULING_SECRET = SECRET;
  process.env.NOTION_API_KEY = "test-notion-key";
  process.env.NOTION_WAIVERS_DB_ID = "waivers";
  process.env.NOTION_PLAYER_CRM_DB_ID = "crm";
  stub.reset(); stub.install();
});
test.afterEach(() => stub.uninstall());

test("missing, wrong, or unset bridge credentials cannot read or write", async () => {
  for (const token of ["", "Bearer invalid"]) {
    expect((await POST(request(valid, token))).status).toBe(401);
  }
  delete process.env.NGA_LESSON_SCHEDULING_SECRET;
  expect((await POST(request())).status).toBe(401);
  process.env.NGA_LESSON_SCHEDULING_SECRET = "short";
  expect((await POST(request(valid, "Bearer short"))).status).toBe(401);
  expect(stub.calls).toHaveLength(0);
});

test("invalid, excessive, or child-bearing input never reaches Notion", async () => {
  for (const body of [null, [], {}, { ...valid, requestId: "bad" },
    { ...valid, parentEmail: "bad" }, { ...valid, parentName: " " },
    { ...valid, partySize: 0 }, { ...valid, partySize: 9 }, { ...valid, partySize: 1.5 },
    { ...valid, childName: "Must not leave NGA" }, { ...valid, medical: "private" },
    { ...valid, parentName: "x".repeat(201) }, { ...valid, parentPhone: "nope" },
    { action: "check_waiver", parentEmail: "a@b.org", parentName: "unexpected" },
  ]) expect((await POST(request(body))).status).toBe(400);
  expect(stub.calls).toHaveLength(0);
});

test("a missing waiver gives the parent a signing link and creates no lead", async () => {
  stub.on("databases/waivers/query", { results: [], has_more: false });
  const res = await POST(request());
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("WAIVER_REQUIRED");
  const url = new URL(body.waiverUrl);
  expect(url.origin).toBe("https://nextgenpbacademy.com");
  expect(url.pathname).toBe("/waiver/sign");
  expect(url.searchParams.get("next")).toBe("/lessons/book");
  expect(stub.calls.every(c => c.url.includes("databases/waivers/query"))).toBe(true);
});

test("a row without a signature or belonging to a different parent is not a waiver", async () => {
  stub.on("databases/waivers/query", { results: [
    { ...waiver, properties: { ...waiver.properties, "Signature Name": { rich_text: [] } } },
    { ...waiver, properties: { ...waiver.properties, "Parent Email": { email: "other@example.org" } } },
  ], has_more: false });
  expect((await POST(request())).status).toBe(409);
});

test("waiver dependency/configuration failures fail closed without revealing provider data", async () => {
  stub.on("databases/waivers/query", { message: "sensitive provider detail" }, 500);
  const res = await POST(request());
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("sensitive");
  expect(stub.calls).toHaveLength(1);
  delete process.env.NOTION_API_KEY;
  expect((await POST(request())).status).toBe(503);
  expect(stub.calls).toHaveLength(1);
});

test("check_waiver is read-only and returns no parent, child, or database identifiers", async () => {
  signed();
  const res = await POST(request({ action: "check_waiver", parentEmail: "parent@example.org" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(stub.calls).toHaveLength(1);
});

test("a new family is captured once, with parent-only fields and direct-source provenance", async () => {
  signed();
  let exists = false;
  stub.on("databases/crm/query", () => ({ results: exists ? [{ id: "family", properties: {
    "Parent Email": { email: "PARENT@example.org" },
  } }] : [], has_more: false }));
  stub.on("https://api.notion.com/v1/pages", () => { exists = true; return { id: "family" }; });
  for (let i = 0; i < 2; i++) {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  }
  const writes = stub.calls.filter(c => c.url.endsWith("/pages"));
  expect(writes).toHaveLength(1);
  const props = JSON.parse(writes[0].body).properties;
  expect(Object.keys(props).sort()).toEqual([
    "Last Contact Date", "Notes", "Parent Email", "Parent Name", "Parent Phone", "Player Name", "Source",
  ]);
  expect(props.Source.select.name).toBe("Website");
  expect(props["Parent Email"].email).toBe("parent@example.org");
  expect(stub.calls.every(c => c.url.startsWith("https://api.notion.com/v1/"))).toBe(true);
});

test("an existing family is not overwritten or automatically opted back in", async () => {
  signed();
  stub.on("databases/crm/query", { results: [{ id: "family", properties: {
    "Parent Email": { email: "parent@example.org" }, Quarantine: { checkbox: true },
  } }], has_more: false });
  expect((await POST(request())).status).toBe(200);
  expect(stub.calls.filter(c => c.url.includes("/pages"))).toHaveLength(0);
});

test("malformed or incomplete CRM reads never create duplicate leads", async () => {
  signed();
  stub.on("databases/crm/query", { results: [], has_more: true, next_cursor: null });
  expect((await POST(request())).status).toBe(503);
  expect(stub.calls.filter(c => c.url.endsWith("/pages"))).toHaveLength(0);
});

test("a rejected CRM create is reported for safe retry", async () => {
  signed();
  stub.on("databases/crm/query", { results: [], has_more: false });
  stub.on("https://api.notion.com/v1/pages", {}, 429);
  expect((await POST(request())).status).toBe(503);
});

test("an unreadable CRM email is not treated as a new family", async () => {
  signed();
  stub.on("databases/crm/query", { results: [{ id: "family", properties: {} }], has_more: false });
  expect((await POST(request())).status).toBe(503);
  expect(stub.calls.filter(c => c.url.endsWith("/pages"))).toHaveLength(0);
});

test("paginated waiver lookup verifies the actual matching parent", async () => {
  stub.on("databases/waivers/query", (c: RecordedFetch) => JSON.parse(c.body).start_cursor
    ? { results: [waiver], has_more: false }
    : { results: [], has_more: true, next_cursor: "next-page" });
  expect((await POST(request({ action: "check_waiver", parentEmail: "parent@example.org" }))).status).toBe(200);
  expect(stub.calls).toHaveLength(2);
});
