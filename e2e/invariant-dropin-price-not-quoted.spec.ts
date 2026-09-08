import { test, expect } from "@playwright/test";
import type { NgaSession } from "../src/lib/notion-sessions";
import { sportsEventJsonLd } from "../src/lib/sports-event-jsonld";
import { LLMS_TXT } from "../src/lib/llms-txt";
import { faq } from "../src/data/faq";
import { blogPosts } from "../src/data/blog";
import {
  buildPostEvalFollowupHtml,
  LEVEL_DESCRIPTIONS,
} from "../src/lib/email/post-eval-followup";
import { postSessionHtml, postSessionText } from "../src/lib/email/post-session";
import { crewConfirmedHtml, crewConfirmedText } from "../src/lib/email/crew-confirmed";

/**
 * The drop-in rate is not quoted on any parent-facing surface (Sam,
 * 2026-09-08). The product still sells at the same Stripe price — parents see
 * the amount on the Stripe checkout page — but no page, feed, or marketing
 * email prints a figure for it.
 *
 * DELIBERATE EXCEPTION, do not "fix" by widening this spec: the four
 * card-on-file surfaces (/commit/[token], CommitForm, /commit/[token]/success,
 * commit-confirmation.ts) still state the per-week amount. That flow saves a
 * card via a Stripe `mode: "setup"` session, which shows the parent NO amount,
 * and the autoreserve cron then charges off-session. Stripping the figure
 * there would take a recurring charge authorization with the amount disclosed
 * nowhere — a dark pattern, not a copy cleanup.
 */

function makeSession(over: Partial<NgaSession> = {}): NgaSession {
  return {
    id: "sess-1",
    title: "Pickl Park Saturday — Open Court",
    date: "2026-09-19",
    startTime: "2:00 PM",
    endTime: "3:00 PM",
    level: "All Levels",
    location: "The Pickl Park, 355 Ballenger Center Dr, Frederick, MD 21703",
    publicArea: "",
    courtCount: 2,
    maxCourts: 2,
    capacity: 8,
    registeredCount: 2,
    spotsLeft: 6,
    status: "Open",
    roster: [],
    ageStats: null,
    coachReminderSent: false,
    ...over,
  };
}

test.describe("drop-in price is not quoted on parent-facing surfaces", () => {
  test("SportsEvent JSON-LD offers carry availability + url, never a price", () => {
    const ld = sportsEventJsonLd(makeSession()) as {
      offers: Record<string, unknown>;
    };
    expect(ld.offers).toBeTruthy();
    expect(ld.offers).not.toHaveProperty("price");
    expect(ld.offers).not.toHaveProperty("priceCurrency");
    // The half that must survive: agents still learn where to book and whether
    // there is room.
    expect(ld.offers.url).toBe("https://nextgenpbacademy.com/schedule");
    expect(ld.offers.availability).toBe("https://schema.org/InStock");
    expect(JSON.stringify(ld)).not.toContain("$");
  });

  test("llms.txt describes the drop-in without a figure", () => {
    expect(LLMS_TXT).toContain("drop-in");
    expect(LLMS_TXT).not.toContain("$");
  });

  test("the FAQ cost answer explains the model without quoting a rate", () => {
    const cost = faq.find((f) => /how much/i.test(f.question));
    expect(cost, "the cost FAQ entry still exists").toBeTruthy();
    expect(cost!.answer).not.toContain("$");
    // Still answers the question it asks: drop-in, no subscription, free eval.
    expect(cost!.answer).toMatch(/drop-in/i);
    expect(cost!.answer).toMatch(/free/i);
  });

  test("no blog post quotes a drop-in rate", () => {
    for (const post of blogPosts) {
      const prose = JSON.stringify(post);
      expect(prose, `blog post ${post.slug}`).not.toContain("$20");
    }
  });

  test("post-eval follow-up quotes no rate but keeps the Reserve CTA", () => {
    const html = buildPostEvalFollowupHtml({
      parentFirstName: "Hun",
      childFirstName: "Zoe",
      level: "Green",
      levelDescription: LEVEL_DESCRIPTIONS.Green,
      observations: "",
      sessionLines: ["Sat, Sep 19 — Frederick, MD · 2:00 PM"],
    });
    expect(html).toContain("Reserve a slot");
    expect(html).not.toContain("$");
  });

  test("post-session and crew-confirmed emails quote no rate", () => {
    const postSession = {
      parentFirst: "Hun",
      childFirst: "Zoe",
      sessionTitle: "Pickl Park Saturday — Open Court",
      sessionDateLong: "Saturday, September 19, 2026",
      scheduleUrl: "https://nextgenpbacademy.com/schedule",
      commitUrl: "https://nextgenpbacademy.com/commit/tok",
    };
    // The 4-week commit pitch rides in this email — it may describe the
    // program, it may not print the weekly charge.
    expect(postSessionHtml(postSession)).toContain("lock in 4 weeks");
    expect(postSessionHtml(postSession)).not.toContain("$");
    expect(postSessionText(postSession)).not.toContain("$");

    const crew = {
      parentFirst: "Hun",
      childFirst: "Zoe",
      crewDescription: "Saturdays at 2:00 PM in Frederick",
      firstSessionLong: "Saturday, September 19, 2026",
      scheduleUrl: "https://nextgenpbacademy.com/schedule",
    };
    expect(crewConfirmedHtml(crew)).toContain("Book session 1");
    expect(crewConfirmedHtml(crew)).not.toContain("$");
    expect(crewConfirmedText(crew)).not.toContain("$");
  });
});
