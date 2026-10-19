import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { FetchStub } from "./fixtures/fetch-stub";
import {
  setWebhookTestEnv,
  checkoutEvent,
  signedHeader,
} from "./fixtures/stripe-sessions";

setWebhookTestEnv();
process.env.NOTION_FALL_REGS_DB_ID = "db-fall-regs-lastname";
process.env.NOTION_MONDAY_GIRLS_REGS_DB_ID = "db-mg-regs-lastname";
process.env.OPEN_BRAIN_INGEST_URL = "https://open-brain.example.com/ingest";
process.env.LEAD_INGEST_TOKEN = "ob-token-lastname";

import { POST } from "../src/app/api/stripe/webhook/route";
import { validateFallRegistration } from "../src/lib/validate-fall-registration";
import { validateMondayGirlsRegistration } from "../src/lib/validate-monday-girls-registration";
import { childLastNameError, cleanChildLastName } from "../src/lib/child-last-name";
import { ingestToOpenBrain } from "../src/lib/open-brain-ingest";

// A child's LAST name is a new child field on the season checkouts (Sam's
// approval, 2026-10-19). Its whole path is pinned here:
//   form -> validator (required, a name and nothing else)
//        -> checkout Stripe metadata (child_last_name, cleaned)
//        -> webhook -> the season's Notion roster row ("Child Last Name")
//                   -> the ADMIN notification
// and nowhere else: never a parent email, never Open Brain, never the ack.
// A row from a checkout started before the field existed still lands.

const FALL_DB = "db-fall-regs-lastname";
const MG_DB = "db-mg-regs-lastname";
const LAST = "Okonkwo-Reyes";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test.describe("child last name — the rule", () => {
  test("required, and only a name", () => {
    expect(childLastNameError("")).toBe("Child last name is required");
    expect(childLastNameError("   ")).toBe("Child last name is required");
    for (const bad of ["a@b.com", "3015550100", "R2D2", "-Smith", "x".repeat(41)]) {
      expect(childLastNameError(bad), bad).not.toBeNull();
    }
    for (const ok of ["Walker", "O'Brien-Lee", "Zoë", "van der Berg", "St. James"]) {
      expect(childLastNameError(ok), ok).toBeNull();
    }
    expect(cleanChildLastName("  van   der Berg ")).toBe("van der Berg");
  });

  test("both season validators require it", () => {
    expect(validateFallRegistration({}).childLastName).toBeDefined();
    expect(validateMondayGirlsRegistration({}).childLastName).toBeDefined();
    expect(
      validateFallRegistration({ childLastName: "Walker" }).childLastName,
    ).toBeUndefined();
    expect(
      validateMondayGirlsRegistration({ childLastName: "nope@x.com" }).childLastName,
    ).toBeDefined();
  });

  test("both checkouts put the cleaned value in metadata, and no other checkout changed", () => {
    for (const r of ["checkout-fall", "checkout-monday-girls"]) {
      expect(src(`src/app/api/${r}/route.ts`)).toContain(
        "child_last_name: cleanChildLastName(data.childLastName)",
      );
    }
  });

  test("the webhook reads it only for the roster rows and the admin lines", () => {
    const hook = src("src/app/api/stripe/webhook/route.ts");
    const reads = hook.match(/metaString\(m, "child_last_name"\)/g) ?? [];
    // 2 roster writes (fall, Monday Girls) + 2 admin "Player:" lines, plus the
    // 2 MVF tournament reads that predate this field (decision D7). A seventh
    // read is a new destination and needs its own approval.
    expect(reads).toHaveLength(6);
    for (const fn of ["emailFallParent", "emailMondayGirlsParent"]) {
      const start = hook.indexOf(`async function ${fn}`);
      if (start < 0) continue;
      const end = hook.indexOf("\nasync function ", start + 1);
      expect(hook.slice(start, end), fn).not.toContain("child_last_name");
    }
  });
});

function session(id: string, kind: "fall" | "monday-girls", last?: string) {
  const base: Record<string, string> = {
    kind,
    group: kind === "fall" ? "Green" : "Girls Beginner",
    group_label: kind === "fall" ? "Green Ball" : "Girls Beginner",
    season_title: "Test season",
    season_label: "Test",
    parent_name: "Test Parent",
    parent_email: "parent@example.com",
    parent_phone: "3015550100",
    child_first_name: "Testkid",
    child_birth_year: "2015",
    emergency_name: "Emergency Person",
    emergency_phone: "3015550101",
    allergies: "",
    waiver_accepted: "true",
    sms_consent: "false",
    sms_consent_text: "",
  };
  if (last !== undefined) base.child_last_name = last;
  return {
    id,
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 22500,
    customer_email: "parent@example.com",
    customer_details: { email: "parent@example.com" },
    payment_intent: `pi_${id}`,
    metadata: base,
  };
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

async function deliver(s: Record<string, unknown>) {
  const payload = checkoutEvent(s);
  return POST(
    new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signedHeader(payload) },
    }),
  ).then(
    (r) => r,
    () => null,
  );
}

for (const [kind, db] of [
  ["fall", FALL_DB],
  ["monday-girls", MG_DB],
] as const) {
  test.describe(`webhook ${kind} branch — last name`, () => {
    test("lands on the roster row and never in the ack", async () => {
      stub
        .on(`/databases/${db}/query`, { results: [] })
        .on("api.notion.com/v1/pages", { id: "row" })
        .on("api.notion.com", { results: [] })
        .on("api.resend.com", { id: "email" })
        .install();

      const res = await deliver(session(`cs_${kind}_last`, kind, LAST));
      const rows = stub.callsTo("/v1/pages").filter((c) => c.body.includes(db));
      expect(rows).toHaveLength(1);
      expect(rows[0].body).toContain('"Child Last Name"');
      expect(rows[0].body).toContain(LAST);
      if (res) expect(JSON.stringify(await res.json())).not.toContain(LAST);
    });

    test("a checkout started before the field existed still writes its row, without the property", async () => {
      stub
        .on(`/databases/${db}/query`, { results: [] })
        .on("api.notion.com/v1/pages", { id: "row" })
        .on("api.notion.com", { results: [] })
        .on("api.resend.com", { id: "email" })
        .install();

      await deliver(session(`cs_${kind}_legacy`, kind));
      const rows = stub.callsTo("/v1/pages").filter((c) => c.body.includes(db));
      expect(rows).toHaveLength(1);
      expect(rows[0].body).not.toContain("Child Last Name");
    });
  });
}

test("Open Brain never receives a child's last name", async () => {
  stub.on("open-brain.example.com", { ok: true }).install();
  await ingestToOpenBrain({
    business: "nga",
    source: "nga_fall_registration",
    name: "Test Parent",
    email: "parent@example.com",
    metadata: { child_first_name: "Testkid", child_last_name: LAST },
  });
  const sent = stub.callsTo("open-brain.example.com");
  expect(sent.length).toBeGreaterThan(0);
  for (const c of sent) expect(c.body).not.toContain(LAST);
});
