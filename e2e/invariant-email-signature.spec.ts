import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  COACH_PHONE_DISPLAY,
  WHATSAPP_LD_GROUP_URL,
  WHATSAPP_NGA_GROUP_URL,
  phoneLineHtml,
  phoneLineText,
  signatureExtrasHtml,
  signatureExtrasText,
  whatsappGroupsHtml,
  whatsappGroupsText,
  whatsappGroupsTopHtml,
  whatsappGroupsTopText,
} from "../src/lib/email/signature";
import {
  newsletterWelcomeHtml,
  newsletterWelcomeText,
} from "../src/lib/email/newsletter-welcome";

/**
 * THE email-signature invariants.
 *
 * Every recipient-facing NGA email carries Coach Sam's phone and BOTH community
 * WhatsApp invites; internal/ops mail carries neither. Enforced at the SOURCE
 * level because the rule spans 30+ templates whose render functions take wildly
 * different inputs — rendering each would need 30+ fixtures and would rot, while
 * the structural claim ("this template composes the shared block") is exactly
 * what must not drift.
 *
 * The NEWSLETTERS are the exception and get RENDERED assertions instead: they
 * carry the invites near the top (Sam, 2026-08-19) and only the phone line in
 * the footer. A source grep can't see placement, and it can't see that the
 * weekly newsletter's HTML used to hide the block inside a conditional lead card
 * — so a normal week shipped with no WhatsApp link at all while this file stayed
 * green. Placement and single-render are asserted on real output below.
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
        if (
          hasHtmlFn &&
          !/signatureExtrasHtml\(\)|whatsappGroupsHtml\(\)|whatsappGroupsTopHtml\(\)/.test(src)
        )
          missing.push(`${f} (html)`);
        if (
          hasTextFn &&
          !/signatureExtrasText\(\)|whatsappGroupsText\(\)|whatsappGroupsTopText\(\)/.test(src)
        )
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

test.describe("email signature — the phone-only half", () => {
  test("phoneLine carries the number and NEITHER group link", () => {
    for (const part of [phoneLineHtml(), phoneLineText()]) {
      expect(part).toContain(COACH_PHONE_DISPLAY);
      expect(part).not.toContain(WHATSAPP_NGA_GROUP_URL);
      expect(part).not.toContain(WHATSAPP_LD_GROUP_URL);
    }
  });

  // The footer block was split so newsletters could keep the phone while moving
  // the invites up. Every other template still composes signatureExtras — its
  // output must not have shifted by a byte.
  test("signatureExtras is still exactly phone + groups", () => {
    expect(signatureExtrasHtml()).toBe(
      `${phoneLineHtml()}\n      ${whatsappGroupsHtml()}`,
    );
    expect(signatureExtrasText()).toBe(
      [phoneLineText(), ``, whatsappGroupsText()].join("\n"),
    );
  });
});

test.describe("email signature — newsletters carry the invites up top", () => {
  const NEWSLETTERS = ["weekly-newsletter.ts", "newsletter-welcome.ts"];

  // Move, not duplicate: a newsletter that composed BOTH would show the same two
  // links twice in one email.
  test("a newsletter uses the top variant and never the full footer block", () => {
    for (const f of NEWSLETTERS) {
      const src = fs.readFileSync(path.join(DIR, f), "utf-8");
      expect(src, `${f} must carry the top variant`).toContain(
        "whatsappGroupsTopHtml()",
      );
      expect(src, `${f} must carry the top variant in text`).toContain(
        "whatsappGroupsTopText()",
      );
      expect(src, `${f} must not re-render the invites in the footer`).not.toContain(
        "signatureExtras",
      );
      expect(src, `${f} keeps the phone in the footer`).toContain("phoneLine");
    }
  });

  const welcome = {
    parentFirst: "Lauren",
    childFirst: "Ava",
    scheduleUrl: "https://nextgenpbacademy.com/schedule",
  };

  test("the welcome email renders both invites once, above the footer phone", () => {
    const html = newsletterWelcomeHtml(welcome);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(html.split(url).length - 1, `${url} must appear once`).toBe(1);
      expect(html.indexOf(url)).toBeLessThan(html.indexOf(COACH_PHONE_DISPLAY));
    }
  });

  test("plain-text welcome mirrors it", () => {
    const text = newsletterWelcomeText(welcome);
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(text.split(url).length - 1, `${url} must appear once`).toBe(1);
      expect(text.indexOf(url)).toBeLessThan(text.indexOf(COACH_PHONE_DISPLAY));
    }
  });

  test("the top strip stays a utility block, not a second CTA", () => {
    // BRAND_GUIDELINES.md → Community-channel invites: no arrow, no chip, and
    // never the accent/callout surfaces reserved for the host email's one CTA.
    const html = whatsappGroupsTopHtml();
    expect(html).not.toContain("&rarr;");
    expect(html).not.toContain("→");
    expect(whatsappGroupsTopText()).not.toContain("→");
  });
});
