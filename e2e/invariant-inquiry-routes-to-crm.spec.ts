import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { FetchStub, type RecordedFetch } from "./fixtures/fetch-stub";

// Env BEFORE importing the routes — they and their libs read these at call time.
process.env.NOTION_API_KEY = "ntn_test_routes_crm";
process.env.NOTION_PLAYER_CRM_DB_ID = "routes-crm-db";
process.env.NOTION_LEAGUE_INTEREST_DB_ID = "league-interest-db";
process.env.NOTION_WAITLIST_DB_ID = "waitlist-db";
process.env.NOTION_CREW_INTEREST_DB_ID = "crew-interest-db";
process.env.NOTION_SESSIONS_DB_ID = "sessions-db";
process.env.RESEND_API_KEY = "re_test_routes_crm";
// Open Brain and the cohort pool self-skip without these. Their payloads are
// pinned by their own egress specs; this file is about the CRM write.
delete process.env.OPEN_BRAIN_INGEST_URL;
delete process.env.LEAD_INGEST_TOKEN;
delete process.env.COACH_OS_COHORT_INTAKE_URL;
delete process.env.COHORT_INTAKE_TOKEN;

import { POST as leagueInterest } from "../src/app/api/league-interest/route";
import { POST as waitlist } from "../src/app/api/waitlist/route";
import { POST as crewInterest } from "../src/app/api/crew-interest/route";
import { POST as yellowball } from "../src/app/api/yellowball-lead/route";

// Every website inquiry form lands a lead in the NGA Player CRM (Sam,
// 2026-10-19). Before this, only /api/lead and /api/contact did, so a family
// who asked about a league, joined the waitlist, asked for a crew or asked
// about Yellow Ball never appeared in the pipeline Sam works from, and the
// daily uncontacted-leads nudge could not see them.
//
// Two things per form: the CRM gets one Lead row with the form as Source,
// beside (never instead of) the form's own row; and a CRM failure never costs
// the family their confirmation.

const CRM_DB = "routes-crm-db";
const FORM_ROW_ID = "f0f0f0f0-1111-2222-3333-444455556666";
const FORM_MARKER = "[sf:f0f0f0f0111122223333444455556666]";
const PARENT_EMAIL = "routes-crm@example.com";

type Handler = (req: NextRequest) => Promise<Response>;

interface FormCase {
  name: string;
  handler: Handler;
  path: string;
  source: string;
  /** The form's own Notion database, or null when it has none. */
  formDb: string | null;
  child: string;
  body: Record<string, unknown>;
}

const CASES: FormCase[] = [
  {
    name: "league interest",
    handler: leagueInterest,
    path: "/api/league-interest",
    source: "League Interest",
    formDb: "league-interest-db",
    child: "Leaguekid",
    body: {
      parentName: "Route Parent",
      email: PARENT_EMAIL,
      phone: "240-555-0134",
      childFirstName: "Leaguekid",
      childAge: "10",
      preferredBand: "10U",
      childLevel: "Green",
    },
  },
  {
    name: "waitlist",
    handler: waitlist,
    path: "/api/waitlist",
    source: "Waitlist",
    formDb: "waitlist-db",
    child: "Waitkid",
    body: {
      parentName: "Route Parent",
      contact: PARENT_EMAIL,
      preferredArea: "Olney",
      marketingOptIn: false,
      childFirstName: "Waitkid",
      childAge: "11",
      childLevel: "Orange",
    },
  },
  {
    name: "crew interest",
    handler: crewInterest,
    path: "/api/crew-interest",
    source: "Crew Interest",
    formDb: "crew-interest-db",
    child: "Crewkid",
    body: {
      parentName: "Route Parent",
      email: PARENT_EMAIL,
      phone: "",
      childFirstName: "Crewkid",
      childAge: "10",
      childLevel: "Green",
      childSubLevel: "High",
      preferredDays: ["Tue", "Thu"],
      preferredTimeOfDay: ["Afternoon"],
      preferredTime: "after school",
      preferredLocation: "Rockville",
      friendsWanted: "Otherkid Neighbor",
    },
  },
  {
    name: "Yellow Ball",
    handler: yellowball,
    path: "/api/yellowball-lead",
    source: "Yellow Ball Inquiry",
    formDb: null,
    child: "Yellowkid",
    body: {
      parent_name: "Route Parent",
      child_name: "Yellowkid Surnameson",
      age: 13,
      contact_email: PARENT_EMAIL,
      contact_phone: "240-555-0134",
      notes: "Plays 3.5 at school",
    },
  },
];

let ipCounter = 0;
function req(path: string, body: Record<string, unknown>): NextRequest {
  // Unique IP per call — every route keeps a 5/hr in-memory limiter per IP.
  ipCounter += 1;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
    },
  });
}

const stub = new FetchStub();
test.beforeEach(() => stub.reset());
test.afterEach(() => stub.uninstall());

/** A CRM that has never seen this family; every other Notion call succeeds. */
function install(crmCreate: { status: number; json: unknown } = { status: 200, json: { id: "crm-row" } }) {
  stub
    .on(`databases/${CRM_DB}/query`, { results: [], has_more: false })
    .onDynamic(/\/v1\/pages$/, (call) =>
      JSON.parse(call.body).parent?.database_id === CRM_DB
        ? crmCreate
        : { status: 200, json: { id: FORM_ROW_ID } },
    )
    .on("api.notion.com", { results: [], has_more: false })
    .on("api.resend.com", { id: "email_test" })
    .install();
}

function createsInto(db: string): RecordedFetch[] {
  return stub.calls.filter(
    (c) =>
      c.method === "POST" &&
      /\/v1\/pages$/.test(c.url) &&
      JSON.parse(c.body).parent?.database_id === db,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function props(call: RecordedFetch): Record<string, any> {
  return JSON.parse(call.body).properties ?? {};
}

function emails(): { to: string[]; body: string }[] {
  return stub.callsTo("api.resend.com").map((c) => {
    const parsed = JSON.parse(c.body) as { to?: string | string[] };
    const to = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
    return { to, body: c.body };
  });
}

for (const form of CASES) {
  test.describe(`${form.name} → Player CRM`, () => {
    test("lands one Lead in the Player CRM, Source = the form", async () => {
      install();
      const res = await form.handler(req(form.path, form.body));
      expect(res.status).toBe(200);

      const crm = createsInto(CRM_DB);
      expect(crm, "exactly one CRM row for a family the CRM has never seen").toHaveLength(1);
      const p = props(crm[0]);
      expect(p.Source.select.name).toBe(form.source);
      expect(p.Status.select.name).toBe("Lead");
      expect(p.Level.select.name, "a parent's colour never becomes Level").toBe("Eval Needed");
      expect(p["Player Name"].title[0].text.content).toBe(form.child);
      expect(p["Parent Email"].email).toBe(PARENT_EMAIL);
      expect(p["Last Inbound Date"].date.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("adds the CRM beside the form's own row; it replaces nothing", async () => {
      install();
      await form.handler(req(form.path, form.body));

      if (form.formDb) {
        expect(createsInto(form.formDb), "the form's own row still lands").toHaveLength(1);
        const notes: string = props(createsInto(CRM_DB)[0]).Notes.rich_text[0].text.content;
        expect(notes, "the CRM line points back at the form row").toContain(FORM_MARKER);
      }
      expect(createsInto(CRM_DB)).toHaveLength(1);
    });

    test("a Player CRM failure still sends the family their confirmation", async () => {
      install({ status: 500, json: { object: "error", message: "boom" } });
      const res = await form.handler(req(form.path, form.body));

      expect(res.status, "a CRM miss must never fail the submission").toBe(200);
      const sent = emails();
      expect(sent.some((e) => e.to.includes(PARENT_EMAIL)), "parent confirmation").toBe(true);
      const admin = sent.find((e) => e.body.includes("Player CRM"));
      expect(admin, "the admin email reports the CRM status").toBeTruthy();
      expect(admin!.body).toContain("failed");
    });

    test("the CRM status is for Sam only, never in the parent's email", async () => {
      install();
      await form.handler(req(form.path, form.body));

      for (const email of emails().filter((e) => e.to.includes(PARENT_EMAIL))) {
        expect(email.body).not.toContain("Player CRM");
      }
    });
  });
}

test.describe("child data reaching the CRM", () => {
  test("Yellow Ball sends the first name only, never a surname", async () => {
    install();
    await yellowball(req("/api/yellowball-lead", CASES[3].body));

    const crm = createsInto(CRM_DB);
    expect(crm).toHaveLength(1);
    expect(crm[0].body).not.toContain("Surnameson");
  });

  test("crew interest keeps the friends field (other children's names) out of the CRM", async () => {
    install();
    await crewInterest(req("/api/crew-interest", CASES[2].body));

    const crm = createsInto(CRM_DB);
    expect(crm).toHaveLength(1);
    expect(crm[0].body).not.toContain("Otherkid");
  });

  test("no form writes a birth year or a level property into the CRM", async () => {
    for (const form of CASES) {
      stub.reset();
      install();
      await form.handler(req(form.path, form.body));

      for (const call of createsInto(CRM_DB)) {
        const keys = Object.keys(props(call));
        expect(keys, `${form.name}`).not.toContain("Child Level");
        expect(keys, `${form.name}`).not.toContain("Child Birth Year");
        expect(call.body.toLowerCase(), `${form.name}`).not.toContain("birth");
      }
    }
  });
});
