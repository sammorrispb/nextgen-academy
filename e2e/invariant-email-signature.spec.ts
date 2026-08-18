import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  COACH_PHONE_DISPLAY,
  WHATSAPP_LD_GROUP_URL,
  WHATSAPP_NGA_GROUP_URL,
  signatureExtrasHtml,
  signatureExtrasText,
  whatsappGroupsHtml,
  whatsappGroupsText,
} from "../src/lib/email/signature";

/**
 * THE email-signature invariants.
 *
 * Every recipient-facing NGA email carries Coach Sam's phone and BOTH community
 * WhatsApp invites; internal/ops mail carries neither. Enforced at the SOURCE
 * level because the rule spans 30+ templates whose render functions take wildly
 * different inputs — rendering each would need 30+ fixtures and would rot, while
 * the structural claim ("this template composes the shared block") is exactly
 * what must not drift.
 */

const DIR = path.join(process.cwd(), "src/lib/email");

// Not templates: shared helpers/components.
const HELPERS = new Set([
  "brand.ts",
  "ics.ts",
  "utm.ts",
  "whatsapp-invite.ts",
  "crew-session-lines.ts",
  "signature.ts",
]);

// Internal/ops mail — deliberately excluded. eval-booking-notify goes to Sam;
// coach-pre-event and camp-checklist-reminder go to coaches. Inviting Sam to
// his own group, or putting a marketing footer on an ops alert, is noise.
const INTERNAL = new Set([
  "eval-booking-notify.ts",
  "coach-pre-event.ts",
  "camp-checklist-reminder.ts",
]);

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !HELPERS.has(f));

const recipientFacing = files.filter((f) => !INTERNAL.has(f));

test.describe("email signature — shared block", () => {
  test("renders the phone and BOTH group links, once each, in html", () => {
    const html = signatureExtrasHtml();
    expect(html).toContain(COACH_PHONE_DISPLAY);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.split(url).length - 1, `${url} must appear once`).toBe(1);
    }
  });

  test("plain-text parity — same phone and both links", () => {
    const text = signatureExtrasText();
    expect(text).toContain(COACH_PHONE_DISPLAY);
    expect(text).toContain(WHATSAPP_NGA_GROUP_URL);
    expect(text).toContain(WHATSAPP_LD_GROUP_URL);
  });

  test("the groups-only block carries both invites but NO phone", () => {
    // lead-confirmation composes this: it prints the phone itself and signs off
    // from BOTH co-founders, so the full block would duplicate one and erase
    // the other.
    for (const part of [whatsappGroupsHtml(), whatsappGroupsText()]) {
      expect(part).toContain(WHATSAPP_NGA_GROUP_URL);
      expect(part).toContain(WHATSAPP_LD_GROUP_URL);
      expect(part).not.toContain(COACH_PHONE_DISPLAY);
    }
  });
});

test.describe("email signature — coverage across templates", () => {
  test("every recipient-facing template composes the shared block", () => {
    const missing: string[] = [];
    for (const f of recipientFacing) {
      const src = fs.readFileSync(path.join(DIR, f), "utf-8");
      const hasHtmlFn = /<!doctype html>/i.test(src);
      const hasTextFn = /export function \w*Text\(/.test(src);
      const usesShared =
        src.includes("signatureExtras") || src.includes("whatsappGroups");
      if (!usesShared) missing.push(f);
      else {
        if (hasHtmlFn && !/signatureExtrasHtml\(\)|whatsappGroupsHtml\(\)/.test(src))
          missing.push(`${f} (html)`);
        if (hasTextFn && !/signatureExtrasText\(\)|whatsappGroupsText\(\)/.test(src))
          missing.push(`${f} (text)`);
      }
    }
    expect(missing, `templates missing the signature block: ${missing.join(", ")}`)
      .toEqual([]);
  });

  test("internal/ops templates carry NO community block", () => {
    for (const f of INTERNAL) {
      const src = fs.readFileSync(path.join(DIR, f), "utf-8");
      expect(src, `${f} must stay ops-only`).not.toContain("signatureExtras");
      expect(src, `${f} must stay ops-only`).not.toContain("whatsappGroups");
    }
  });

  // The double-render trap: 9 templates used to render the standalone NGA
  // invite. The shared block now carries it, so keeping both would show the
  // same group twice in one email.
  test("no template renders both the standalone invite and the shared block", () => {
    const doubled = files.filter((f) => {
      const src = fs.readFileSync(path.join(DIR, f), "utf-8");
      return (
        src.includes("whatsappInvite") &&
        (src.includes("signatureExtras") || src.includes("whatsappGroups"))
      );
    });
    expect(doubled, `double invite in: ${doubled.join(", ")}`).toEqual([]);
  });

  test("the L&D invite reaches every recipient-facing template", () => {
    // Sam's call (2026-08-17): both communities on every recipient-facing
    // email, overriding a brand-matched-only recommendation.
    const withoutLd = recipientFacing.filter((f) => {
      const src = fs.readFileSync(path.join(DIR, f), "utf-8");
      return !/signatureExtras|whatsappGroups/.test(src);
    });
    expect(withoutLd).toEqual([]);
  });
});
