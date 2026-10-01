import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import { POST as retiredPost } from "../src/app/api/fall-interest/route";
import * as fallInterest from "../src/lib/notion-fall-interest";

// Fall Interest egress invariant, after retirement. The /fall survey form
// (FallInterestForm) retired with the season-registration conversion, but its
// route stayed live and upserted by email: anyone who knew a family's address
// could overwrite that family's child name, birth year and level, and have NGA
// email the address and forward the answers to Open Brain (security review
// 2026-09-28 follow-up). With no form to call it, the route now answers
// 410 Gone and touches nothing: no Notion write, no email, no Open Brain.
// The coach calendar's read-only demand query (fetchFallInterestDemand) stays.
//
// Env lives in the hooks, not at module scope: Playwright runs every spec's
// module scope in the runner while collecting and forks workers with that
// environment. Every egress env is SET to a fake value, so the route could
// reach Notion, Resend and Open Brain if it tried; the stub has no rules, so
// any fetch at all throws and is recorded.
const TOUCHED_ENV = {
  NOTION_API_KEY: "ntn_test_fall_interest",
  NOTION_FALL_INTEREST_DB_ID: "fall-interest-db",
  RESEND_API_KEY: "re_test_fall_interest",
  OPEN_BRAIN_INGEST_URL: "https://open-brain.test/ingest",
  LEAD_INGEST_TOKEN: "ob_test_token",
} as const;
const savedEnv = Object.fromEntries(
  Object.keys(TOUCHED_ENV).map((k) => [k, process.env[k]]),
);

const CHILD_NAME = "Egressfallkid";
const PARENT_EMAIL = "egress-fall@example.com";

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    respondentName: "Egress Parent",
    email: PARENT_EMAIL,
    phone: "",
    track: ["youth"],
    childFirstName: CHILD_NAME,
    childAge: "10",
    childLevel: "Green",
    days: ["Sunday"],
    commitment: "Yes — full season, paid up front",
    subListInterest: true,
    youthPriceBand: "$20–25 an hour",
    ...over,
  });
}

// The retired handler takes no arguments; the spec still hands it a full
// request, so nothing a caller sends can matter.
const POST: (request: NextRequest) => Promise<Response> = retiredPost;

let ipCounter = 0;
function req(payload: string): NextRequest {
  ipCounter++;
  return new NextRequest("http://localhost/api/fall-interest", {
    method: "POST",
    body: payload,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.9.0.${ipCounter}`,
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  Object.assign(process.env, TOUCHED_ENV);
  stub.reset();
  stub.install();
});
test.afterEach(() => stub.uninstall());
test.afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test.describe("fall-interest route — retired", () => {
  test("a valid youth submission is 410 Gone with zero network calls", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(410);
    // No Notion upsert, no Resend email, no Open Brain ingest.
    expect(stub.calls).toHaveLength(0);
  });

  test("a re-submission for an address that already answered writes nothing", async () => {
    // The overwrite this retirement closes: same email, different child.
    await POST(req(body()));
    const res = await POST(req(body({ childFirstName: "Overwritten", childLevel: "Yellow" })));
    expect(res.status).toBe(410);
    expect(stub.calls).toHaveLength(0);
  });

  test("the 410 echoes nothing the caller sent", async () => {
    const res = await POST(req(body()));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(CHILD_NAME);
    expect(text).not.toContain(PARENT_EMAIL);
  });

  test("malformed and empty bodies are 410 too, never a 400 that reveals validation", async () => {
    for (const payload of ["not json", "{}", body({ childAge: "3" })]) {
      const res = await POST(req(payload));
      expect(res.status).toBe(410);
    }
    expect(stub.calls).toHaveLength(0);
  });

  test("the Fall Interest DB has no writer left to re-wire", () => {
    expect(Object.keys(fallInterest).sort()).toEqual(["fetchFallInterestDemand"]);
    const src = readFileSync(
      join(__dirname, "..", "src", "lib", "notion-fall-interest.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/method:\s*"(PATCH|DELETE)"/);
    expect(src).not.toMatch(/\/pages[`"]/);
  });
});

test.describe("fetchFallInterestDemand — the read-only coach calendar query stays", () => {
  test("reads youth rows as a counts-only projection", async () => {
    stub.reset();
    stub
      .on("databases/fall-interest-db/query", {
        results: [
          {
            properties: {
              Name: { title: [{ plain_text: "Egress Parent" }] },
              "Child First Name": { rich_text: [{ plain_text: CHILD_NAME }] },
              "Child Level": { select: { name: "Green" } },
              "Child Birth Year": { number: 2016 },
              Days: { multi_select: [{ name: "Sunday" }] },
              "Sub List": { checkbox: true },
            },
          },
        ],
        has_more: false,
      })
      .install();

    const result = await fallInterest.fetchFallInterestDemand();
    expect(result.ok).toBe(true);
    expect(result.rows).toEqual([
      { childLevel: "Green", childBirthYear: 2016, days: ["Sunday"], subListInterest: true },
    ]);
    expect(JSON.stringify(result)).not.toContain(CHILD_NAME);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].method).toBe("POST"); // Notion's query endpoint is a POST
    expect(stub.calls[0].url).toContain("/databases/fall-interest-db/query");
  });
});
