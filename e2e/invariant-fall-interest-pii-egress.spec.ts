import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the route — the route + its libs read these at call time.
// Open Brain env is deliberately absent so ingestToOpenBrain self-skips: this
// spec proves there is no shadow egress beyond Notion + Resend.
process.env.NOTION_API_KEY = "ntn_test_fall_interest";
process.env.NOTION_FALL_INTEREST_DB_ID = "fall-interest-db";
process.env.RESEND_API_KEY = "re_test_fall_interest";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;

import { POST } from "../src/app/api/fall-interest/route";

// Fall Interest egress invariant. The /fall survey opens a NEW destination for
// child fields (a new Notion DB) — a hostile-review trigger under the
// minor-data governance rules. Child first name, derived birth year, and color
// group may flow ONLY to Notion (the interest row) and Resend (parent
// confirmation + admin notification), and the recipient is always the adult who
// filled the form. The JSON ack must never echo child PII.
const ALLOWED_HOSTS = ["api.notion.com", "api.resend.com"];
const CHILD_NAME = "Egressfallkid";
const PARENT_EMAIL = "egress-fall@example.com";
const ADMIN_EMAIL = "sam.morris2131@gmail.com";

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    respondentName: "Egress Parent",
    email: PARENT_EMAIL,
    phone: "",
    track: ["youth"],
    childFirstName: CHILD_NAME,
    childAge: "10",
    childLevel: "Green",
    days: ["Saturday", "Sunday"],
    commitment: "Yes — full season, paid up front",
    subListInterest: true,
    youthPriceBand: "$20–25 an hour",
    ...over,
  });
}

// The route carries a module-scope 5/hr-per-IP limiter that persists across
// tests in this file, so every request gets its own client IP — otherwise the
// sixth test in the file would assert against a 429 instead of the real path.
let ipCounter = 0;
function req(payload: string): NextRequest {
  ipCounter++;
  return new NextRequest("http://localhost/api/fall-interest", {
    method: "POST",
    body: payload,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${ipCounter}`,
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub
    // No existing row → the upsert creates one.
    .on("databases/fall-interest-db/query", { results: [], has_more: false })
    .on("api.notion.com/v1/pages", { id: "fall-row-created" })
    .on("api.resend.com", { id: "email_test" })
    .install();
});
test.afterEach(() => stub.uninstall());

test.describe("fall-interest route — child-PII egress", () => {
  test("child fields reach only Notion + Resend", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(200);

    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      const host = new URL(call.url).host;
      expect(ALLOWED_HOSTS, `unexpected egress to ${call.url}`).toContain(host);
      expect(call.url).not.toContain("open-brain");
    }
  });

  test("child fields land on the Notion row as first name + birth year only", async () => {
    await POST(req(body()));

    const create = stub.callsTo("api.notion.com/v1/pages");
    expect(create).toHaveLength(1);
    expect(create[0].body).toContain(CHILD_NAME);
    expect(create[0].body).toContain("Green");
    // Birth year, never a full date of birth.
    expect(create[0].body).toContain("Child Birth Year");
    expect(create[0].body).not.toContain("Child Age");
    expect(create[0].body).not.toContain("Date of Birth");
  });

  test("every email recipient is the adult who filled the form, or admin", async () => {
    await POST(req(body()));

    const sends = stub.callsTo("api.resend.com");
    expect(sends.length).toBeGreaterThan(0);
    for (const send of sends) {
      const payload = JSON.parse(send.body);
      const to = Array.isArray(payload.to) ? payload.to : [payload.to];
      for (const addr of to) {
        expect([PARENT_EMAIL, ADMIN_EMAIL]).toContain(addr);
      }
    }
  });

  test("JSON ack never echoes child PII or the respondent's email", async () => {
    const res = await POST(req(body()));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(PARENT_EMAIL);
  });

  test("an adult-only submission writes no child fields at all", async () => {
    await POST(
      req(
        body({
          track: ["adult"],
          childFirstName: undefined,
          childAge: undefined,
          childLevel: undefined,
          adultBracket: "Playing",
          youthPriceBand: undefined,
          adultPriceBand: "$20–25 an hour",
        }),
      ),
    );

    const create = stub.callsTo("api.notion.com/v1/pages");
    expect(create).toHaveLength(1);
    expect(create[0].body).not.toContain("Child First Name");
    expect(create[0].body).not.toContain("Child Birth Year");
    expect(create[0].body).not.toContain("Child Level");

    for (const send of stub.callsTo("api.resend.com")) {
      expect(send.body).not.toContain(CHILD_NAME);
    }
  });

  test("a re-submission updates the same row instead of duplicating the family", async () => {
    stub.reset();
    stub
      .on("databases/fall-interest-db/query", {
        results: [{ id: "existing-fall-row", properties: {} }],
        has_more: false,
      })
      .on("api.notion.com/v1/pages/existing-fall-row", { id: "existing-fall-row" })
      .on("api.notion.com/v1/pages", { id: "should-not-be-created" })
      .on("api.resend.com", { id: "email_test" })
      .install();

    await POST(req(body()));

    const patches = stub
      .callsTo("api.notion.com/v1/pages/existing-fall-row")
      .filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(1);
    const creates = stub
      .callsTo("api.notion.com/v1/pages")
      .filter((c) => c.method === "POST");
    expect(creates).toHaveLength(0);
  });

  test("a failed Notion write is a hard 500 — the response IS the payload", async () => {
    stub.reset();
    stub
      .on("databases/fall-interest-db/query", { results: [], has_more: false })
      .on("api.notion.com/v1/pages", { message: "boom" }, 500)
      .on("api.resend.com", { id: "email_test" })
      .install();

    const res = await POST(req(body()));
    expect(res.status).toBe(500);
    // Nothing is emailed on a lost response — no false "we got it".
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });

  test("validation failure writes nothing and emails nobody", async () => {
    const res = await POST(req(body({ childAge: "3" })));
    expect(res.status).toBe(400);
    expect(stub.callsTo("api.notion.com/v1/pages")).toHaveLength(0);
    expect(stub.callsTo("api.resend.com")).toHaveLength(0);
  });
});
