import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { site } from "../src/data/site";
import {
  WHATSAPP_LD_GROUP_URL,
  WHATSAPP_NGA_GROUP_URL,
} from "../src/lib/email/signature";

/**
 * THE community-invite web invariants.
 *
 * Both WhatsApp groups have led every recipient-facing email since 2026-08-19,
 * but until 2026-08-25 the web carried the parent group on ONE page, as the 4th
 * pill in a social row labelled just "WhatsApp" — and never carried the adult
 * group at all. `CommunityGroupsCard` is the fix; this file pins the two things
 * that would silently undo it: a page quietly dropping the card, and the two
 * URL shapes being "unified" by someone who noticed they differ.
 *
 * Source-level, like invariant-email-signature.spec.ts: /schedule and /fall are
 * async server components that fetch Notion and Stripe, so rendering them here
 * would need fixtures for data this assertion doesn't care about. The structural
 * claim — "this page composes the card" — is exactly what must not drift.
 * Placement and the rendered CTA are asserted in homepage.spec.ts, which drives
 * a real browser.
 */

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Every public surface that must carry the invite. */
const PAGES = [
  "src/app/page.tsx",
  "src/app/schedule/page.tsx",
  "src/app/crew/page.tsx",
  "src/app/fall/page.tsx",
];

const CARD = "src/components/CommunityGroupsCard.tsx";

test.describe("community groups — reach", () => {
  for (const page of PAGES) {
    test(`${page} renders CommunityGroupsCard`, () => {
      const src = read(page);
      expect(src).toContain('from "@/components/CommunityGroupsCard"');
      expect(src).toMatch(/<CommunityGroupsCard[\s>]/);
    });
  }

  test("the footer carries the parent group site-wide", () => {
    const footer = read("src/components/Footer.tsx");
    expect(footer).toContain("site.whatsapp");
    expect(footer).toContain("Next Gen parents WhatsApp");
  });
});

test.describe("community groups — the card", () => {
  const card = read(CARD);

  test("links BOTH groups, own group first", () => {
    expect(card).toContain("site.whatsapp");
    expect(card).toContain("site.whatsappLinkAndDink");
    expect(card.indexOf("site.whatsapp\n")).toBeLessThan(
      card.indexOf("site.whatsappLinkAndDink"),
    );
  });

  test("names the shared room, so a parent knows the space is shared", () => {
    // BRAND_GUIDELINES.md §WhatsApp invites — Privacy. The discoverability rule
    // was superseded 2026-08-25; this half of it was not.
    expect(card).toMatch(/other Next Gen parents/);
  });

  test("carries no arrow — it must not compete with a page's primary CTA", () => {
    // Comments stripped first: the component documents this very rule, and an
    // arrow inside that prose is not an arrow on a link.
    const markup = card
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(markup).not.toContain("&rarr;");
    expect(markup).not.toContain("\u2192");
  });

  test("both links open in a new tab, safely", () => {
    expect(card.match(/target="_blank"/g)).toHaveLength(2);
    expect(card.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });

  test("clicks are tracked, like every other CTA", () => {
    expect(card).toContain("community_whatsapp_nga");
    expect(card).toContain("community_whatsapp_ld");
  });
});

test.describe("community groups — the two URL shapes are deliberate", () => {
  /**
   * Same invite codes, different share params: web uses `?s=cl&p=i&mlu=2`,
   * email uses `?mode=gi_t`. Both are live. A well-meaning "let's have one
   * constant" refactor would repoint one channel's links, so the split is
   * pinned rather than left to a comment.
   */
  const inviteCode = (url: string) =>
    new URL(url).pathname.replace(/^\//, "");

  test("web and email point at the SAME two groups", () => {
    expect(inviteCode(site.whatsapp)).toBe(inviteCode(WHATSAPP_NGA_GROUP_URL));
    expect(inviteCode(site.whatsappLinkAndDink)).toBe(
      inviteCode(WHATSAPP_LD_GROUP_URL),
    );
  });

  test("web surfaces use the web share params", () => {
    for (const url of [site.whatsapp, site.whatsappLinkAndDink]) {
      expect(url).toContain("?s=cl&p=i&mlu=2");
      expect(url).not.toContain("mode=gi_t");
    }
  });

  test("email constants keep theirs", () => {
    for (const url of [WHATSAPP_NGA_GROUP_URL, WHATSAPP_LD_GROUP_URL]) {
      expect(url).toContain("?mode=gi_t");
    }
  });
});
