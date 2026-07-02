import { test, expect } from "@playwright/test";
import { escapeHtml } from "../src/lib/html";
import { playerCrmDbId, PLAYER_CRM_DB_ID_FALLBACK } from "../src/lib/notion-utils";
import { leadConfirmationHtml } from "../src/lib/email/lead-confirmation";
import {
  buildEvalBookingRequestIcs,
  evalBookingNotifyHtml,
  type EvalBookingNotifyInput,
} from "../src/lib/email/eval-booking-notify";
import type { OpenEvalSlot } from "../src/lib/notion-eval-slots";

// Unit-level pins for the PR #244 code-review fixes that don't need the full
// route harness: F2/F9 (shared HTML escaper on the new templates), F6 (coach
// .ics UID identity), F8 (legacy NOTION_DB_ID no longer steers the Player CRM).

const XSS = `<img src=x onerror="alert('pwn')">&"quotes"`;

function slot(id: string, date = "2036-07-10"): OpenEvalSlot {
  return {
    id,
    date,
    startTime: "5:30 PM",
    endTime: "6:00 PM",
    location: "Cabin John MS",
  };
}

function notifyInput(over: Partial<EvalBookingNotifyInput> = {}): EvalBookingNotifyInput {
  return {
    parentName: "Pat Parent",
    parentEmail: "pat@example.com",
    parentPhone: "301-555-0142",
    childFirst: "Kiddo",
    level: "Green",
    bookingId: "33333333-3333-4333-8333-333333333333",
    slot: slot("11111111-1111-4111-8111-111111111111"),
    ...over,
  };
}

test.describe("escapeHtml — shared escaper (F9)", () => {
  test("escapes all five XSS-relevant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  test("ampersand first — no double-escaping of entities it produces", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  test("plain text passes through untouched", () => {
    expect(escapeHtml("Pat O. Parent-Smith 301-555-0142")).toBe(
      "Pat O. Parent-Smith 301-555-0142",
    );
  });
});

test.describe("lead-confirmation template escapes user values (F2)", () => {
  test("parentName cannot inject markup", () => {
    const html = leadConfirmationHtml({ parentName: XSS, isFirstTimer: false });
    expect(html).not.toContain("<img");
    // The attribute quote is neutralized (the word "onerror" surviving as
    // inert text is fine — the tag + quotes cannot re-form).
    expect(html).not.toContain('onerror="');
    expect(html).toContain("&lt;img");
  });
});

test.describe("eval-booking-notify template escapes user values (F9)", () => {
  test("every interpolated booking field is escaped", () => {
    const html = evalBookingNotifyHtml(
      notifyInput({
        parentName: XSS,
        childFirst: `<b>Kid</b>`,
        parentPhone: `301" onmouseover="x`,
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>Kid</b>");
    expect(html).not.toContain('" onmouseover="');
    expect(html).toContain("&lt;img");
  });

  test("admin notify carries slot id + booking id for race reconciliation (F4)", () => {
    const input = notifyInput();
    const html = evalBookingNotifyHtml(input);
    expect(html).toContain(input.slot.id);
    expect(html).toContain(input.bookingId);
  });
});

test.describe("coach .ics UID (F6)", () => {
  test("UID includes the slot id — stable per slot, distinct across slots", () => {
    const a = buildEvalBookingRequestIcs(
      notifyInput({ slot: slot("aaaa1111-1111-4111-8111-111111111111") }),
      ["sam.morris2131@gmail.com"],
    );
    const aAgain = buildEvalBookingRequestIcs(
      notifyInput({ slot: slot("aaaa1111-1111-4111-8111-111111111111") }),
      ["sam.morris2131@gmail.com"],
    );
    // Same child + same date, DIFFERENT slot (the back-to-back-slots case
    // that used to collide).
    const b = buildEvalBookingRequestIcs(
      notifyInput({ slot: slot("bbbb2222-2222-4222-8222-222222222222") }),
      ["sam.morris2131@gmail.com"],
    );
    const uid = (ics: string | null) => ics?.match(/^UID:(.+)$/m)?.[1];
    expect(uid(a)).toContain("aaaa1111-1111-4111-8111-111111111111");
    expect(uid(a), "stable per slot").toBe(uid(aAgain));
    expect(uid(a), "distinct across slots").not.toBe(uid(b));
  });
});

test.describe("playerCrmDbId — legacy NOTION_DB_ID is dead for CRM targeting (F8)", () => {
  const saved = {
    canonical: process.env.NOTION_PLAYER_CRM_DB_ID,
    legacy: process.env.NOTION_DB_ID,
  };
  test.afterEach(() => {
    if (saved.canonical === undefined) delete process.env.NOTION_PLAYER_CRM_DB_ID;
    else process.env.NOTION_PLAYER_CRM_DB_ID = saved.canonical;
    if (saved.legacy === undefined) delete process.env.NOTION_DB_ID;
    else process.env.NOTION_DB_ID = saved.legacy;
  });

  test("canonical env wins when set", () => {
    process.env.NOTION_PLAYER_CRM_DB_ID = "canonical-db";
    process.env.NOTION_DB_ID = "legacy-db";
    expect(playerCrmDbId()).toBe("canonical-db");
  });

  test("ONLY legacy NOTION_DB_ID set → the canonical literal fallback, NOT the legacy value", () => {
    delete process.env.NOTION_PLAYER_CRM_DB_ID;
    process.env.NOTION_DB_ID = "legacy-db";
    expect(playerCrmDbId()).toBe(PLAYER_CRM_DB_ID_FALLBACK);
  });

  test("neither set → the canonical literal fallback", () => {
    delete process.env.NOTION_PLAYER_CRM_DB_ID;
    delete process.env.NOTION_DB_ID;
    expect(playerCrmDbId()).toBe(PLAYER_CRM_DB_ID_FALLBACK);
  });
});
