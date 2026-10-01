import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Pin every key these routes read. Sam's shell exports real RESEND/NOTION keys,
// so a spec that relied on an absent key would take a different path locally
// than in CI.
process.env.RESEND_API_KEY = "re_test_escaping";
process.env.NOTION_API_KEY = "ntn_test_escaping";
process.env.NOTION_WAITLIST_DB_ID = "escaping-waitlist-db";
process.env.NOTION_PLAYER_CRM_DB_ID = "escaping-crm-db";
process.env.NOTION_INSTITUTIONAL_DB_ID = "escaping-institutional-db";
process.env.NOTION_WEBHOOK_SECRET = "escaping-webhook-secret";
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;

import { POST as schoolsLead } from "../src/app/api/schools-lead/route";
import { POST as waitlist } from "../src/app/api/waitlist/route";
import { POST as yellowballLead } from "../src/app/api/yellowball-lead/route";
import { POST as lead } from "../src/app/api/lead/route";
import { POST as sessionWebhook } from "../src/app/api/notion-session-webhook/route";
import { mvfTournamentSignupConfirmationHtml } from "../src/lib/email/mvf-tournament-signup-confirmation";

// Anonymous forms send HTML email to an address the submitter chooses, from
// noreply@nextgenpbacademy.com. Anything the submitter typed must reach that
// HTML as text, never as markup — otherwise the form is a phishing relay that
// passes SPF/DKIM for NGA's domain (security review 2026-09-28, M2).
const EVIL = '<a href="https://evil.example/pay">Verify payment</a>';
const RAW_ANCHOR = '<a href="https://evil.example/pay"';
const VICTIM = "victim-escaping@example.com";

let ip = 0;
function req(path: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  // Unique IP per call — each route's in-memory limiter is 5/hr per IP.
  ip += 1;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.9.${Math.floor(ip / 250)}.${ip % 250}`,
      ...headers,
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => {
  stub.reset();
  stub
    .on(`databases/escaping-waitlist-db/query`, {
      results: [
        {
          id: "waitlist-row-1",
          properties: {
            "Parent Name": { rich_text: [{ plain_text: EVIL }] },
            "Parent Email": { email: VICTIM },
            "Preferred Area": { select: { name: "Olney" } },
            Status: { select: { name: "Active" } },
          },
        },
      ],
    })
    .on("api.notion.com/v1/pages", { id: "escaping-page" })
    .on("api.notion.com", { results: [] })
    .on("api.resend.com", { id: "email_test" })
    .install();
});
test.afterEach(() => stub.uninstall());

interface SentEmail {
  to: string | string[];
  subject: string;
  html: string;
}

function sentEmails(): SentEmail[] {
  return stub
    .callsTo("api.resend.com")
    .map((c: RecordedFetch) => JSON.parse(c.body) as SentEmail);
}

function emailTo(address: string): SentEmail {
  const matches = sentEmails().filter((e) =>
    Array.isArray(e.to) ? e.to.includes(address) : e.to === address,
  );
  expect(matches, `exactly one email to ${address}`).toHaveLength(1);
  return matches[0];
}

function expectInert(html: string) {
  expect(html).not.toContain(RAW_ANCHOR);
  expect(html).toContain("&lt;a");
  expect(html, "double-escaped").not.toContain("&amp;lt;");
}

test.describe("public-form emails render submitted text inert", () => {
  test("schools-lead: org + contact email (to the submitted address) and admin email", async () => {
    const res = await schoolsLead(
      req("/api/schools-lead", {
        orgName: EVIL,
        contactName: EVIL,
        role: EVIL,
        email: VICTIM,
        orgType: "school",
        studentCount: "1-15",
        ageRange: "K-2",
        frequency: "one_off",
        preferredDates: EVIL,
        location: EVIL,
        notes: EVIL,
        utm_source: EVIL,
      }),
    );
    expect(res.status).toBe(200);
    expect(sentEmails()).toHaveLength(2);
    expectInert(emailTo(VICTIM).html);
    const admin = sentEmails().find((e) => e.subject.startsWith("New Schools"))!;
    expect(admin.to).not.toBe(VICTIM);
    expectInert(admin.html);
  });

  test("schools-lead: names with accents/apostrophes are unchanged in the subject", async () => {
    const res = await schoolsLead(
      req("/api/schools-lead", {
        orgName: "Zoë O'Brien Académie",
        contactName: "José",
        email: VICTIM,
        orgType: "school",
        studentCount: "1-15",
        ageRange: "K-2",
        frequency: "one_off",
      }),
    );
    expect(res.status).toBe(200);
    const admin = sentEmails().find((e) => e.subject.startsWith("New Schools"))!;
    expect(admin.subject).toContain("Zoë O'Brien Académie");
    expect(emailTo(VICTIM).html).toContain("José");
  });

  test("waitlist: parent confirmation to the submitted address", async () => {
    const res = await waitlist(
      req("/api/waitlist", {
        parentName: EVIL,
        contact: VICTIM,
        preferredArea: "Olney",
        marketingOptIn: false,
        childFirstName: "Kid",
        childAge: "10",
        childLevel: "Green",
      }),
    );
    expect(res.status).toBe(200);
    expectInert(emailTo(VICTIM).html);
  });

  test("yellowball-lead: parent confirmation and admin email", async () => {
    const res = await yellowballLead(
      req("/api/yellowball-lead", {
        parent_name: EVIL,
        child_name: EVIL,
        age: 13,
        contact_email: VICTIM,
        contact_phone: "301-555-0100",
        notes: EVIL,
      }),
    );
    expect(res.status).toBe(200);
    expect(sentEmails()).toHaveLength(2);
    for (const e of sentEmails()) expectInert(e.html);
  });

  test("yellowball-lead: a space-free payload in the first word is inert too", async () => {
    const tight = "<a/href=https://evil.example>x</a>";
    const res = await yellowballLead(
      req("/api/yellowball-lead", {
        parent_name: tight,
        child_name: tight,
        age: 13,
        contact_email: VICTIM,
        contact_phone: "301-555-0100",
      }),
    );
    expect(res.status).toBe(200);
    expect(emailTo(VICTIM).html).not.toContain("<a/href");
  });

  test("lead: admin email", async () => {
    const res = await lead(
      req("/api/lead", {
        parentName: EVIL,
        contact: VICTIM,
        kids: [{ name: "Kid", age: 9 }],
        utm_source: EVIL,
        referrer: EVIL,
      }),
    );
    expect(res.status).toBe(200);
    const admin = sentEmails().find((e) => e.subject.startsWith("New Lead"))!;
    expectInert(admin.html);
  });

  test("notion-session-webhook: waitlist blast uses the stored (form-supplied) parent name", async () => {
    const res = await sessionWebhook(
      req(
        "/api/notion-session-webhook",
        {
          properties: {
            Session: { title: [{ plain_text: "Green Ball Drop-in" }] },
            Date: { date: { start: "2026-10-10" } },
            Location: { rich_text: [{ plain_text: "Olney Manor Park" }] },
          },
        },
        { "x-nga-webhook-secret": "escaping-webhook-secret" },
      ),
    );
    expect(res.status).toBe(200);
    expectInert(emailTo(VICTIM).html);
  });

  test("MVF signup confirmation (sent before payment to the submitted address)", () => {
    const html = mvfTournamentSignupConfirmationHtml({
      parentFirst: EVIL,
      childFirst: EVIL,
      divisionLabel: "10U",
      amountUsd: "60.00",
      residencyLabel: "resident",
      payUrl: "https://invoice.stripe.com/i/test",
    });
    expectInert(html);
    expect(html).toContain('href="https://invoice.stripe.com/i/test"');
  });
});
