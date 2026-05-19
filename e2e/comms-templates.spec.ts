import { test, expect } from "@playwright/test";
import {
  bookingReminderHtml,
  bookingReminderText,
} from "../src/lib/email/booking-reminder";
import {
  sessionCancelledHtml,
  sessionCancelledText,
} from "../src/lib/email/session-cancelled";
import {
  postSessionHtml,
  postSessionText,
} from "../src/lib/email/post-session";
import { bookingReminderSms, sessionCancelledSms } from "../src/lib/sms";

const sample = {
  parentFirst: "Alex",
  childFirst: "Riley",
  sessionTitle: "Green Ball Drop-in",
  sessionDateLong: "Saturday, May 23, 2026",
  sessionStart: "5:30 PM",
  sessionLocation: "Cabin John RP, Bethesda MD",
  detailUrl: "https://www.nextgenpbacademy.com/schedule/green-ball-drop-in-2026-05-23",
};
const cancelUrl =
  "https://www.nextgenpbacademy.com/schedule/cancel?token=signed.token.here";

test.describe("Comms templates — 24h reminder", () => {
  // These are pure-function checks. No page navigation, no dev server. Run
  // with: `npx playwright test e2e/comms-templates.spec.ts --project=desktop`

  test("HTML email body carries Coach Sam signoff + tagline + EASE-Attitude framing", () => {
    const html = bookingReminderHtml({ ...sample, cancelUrl });

    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
    expect(html).toContain("better than yesterday, together.");
    // EASE-Attitude: "show up ready to grow" / "the more rest...the better the reps"
    expect(html).toMatch(/grow|rest|reps/);
    // Coach voice opens with kid's name doing something concrete
    expect(html).toContain("Riley is on the court tomorrow");
    // Helpful-action-first cancel copy
    expect(html).toContain("the next player can grab the seat");
    expect(html).toContain(cancelUrl);
    // Single arrowed CTA = Maps. "View session details" must not have an arrow.
    expect(html).toContain("Open in Google Maps &rarr;");
    expect(html).not.toContain("View session details &rarr;");
  });

  test("HTML email falls back to phone/text cue when cancelUrl is absent", () => {
    const html = bookingReminderHtml({ ...sample, cancelUrl: undefined });
    expect(html).toContain("301-325-4731");
    expect(html).toContain("open the seat");
  });

  test("plain-text fallback has parity: Maps URL, scannable list, cancel URL, Coach Sam signoff", () => {
    const text = bookingReminderText({ ...sample, cancelUrl });
    expect(text).toContain("Directions: https://www.google.com/maps/dir/");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("better than yesterday, together.");
    // Scannable list, not comma-joined
    expect(text).toMatch(/- Water bottle, packed/);
    expect(text).toMatch(/- Court shoes/);
    expect(text).toContain(cancelUrl);
  });

  test("SMS body opens with the kid's name, signs off as Coach Sam, keeps STOP language", () => {
    const sms = bookingReminderSms({
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionStart: "5:30 PM",
      sessionDateShort: "Sat May 23",
      detailUrl: sample.detailUrl,
    });
    // No robot prefix
    expect(sms.startsWith("NGA:")).toBe(false);
    expect(sms.startsWith("Riley is on the court tomorrow")).toBe(true);
    expect(sms).toContain("— Coach Sam · NGA");
    expect(sms).toContain("Reply STOP to opt out.");
  });
});

test.describe("Comms templates — session-cancellation broadcast", () => {
  const cancelSample = {
    parentFirst: "Alex",
    childFirst: "Riley",
    sessionTitle: "Green Ball Drop-in",
    sessionDateLong: "Saturday, May 23, 2026",
    sessionStart: "5:30 PM",
    amountRefunded: "40.00",
    scheduleUrl: "https://www.nextgenpbacademy.com/schedule",
  };

  test("weather variant: date-agnostic headline + EASE-Ethics refund framing + Coach Sam signoff", () => {
    const html = sessionCancelledHtml({ ...cancelSample, reason: "weather" });
    // Date-agnostic — must NOT say "Tomorrow" in the headline
    expect(html).toContain("Weather call — this session is off.");
    expect(html).not.toMatch(/Tomorrow's session is off/);
    // EASE-Ethics: refund without being asked
    expect(html).toContain("Your $40.00 is on the way back.");
    expect(html).toContain("No action needed on your end &mdash; that&rsquo;s on us.");
    // Coach Sam signoff + tagline twist appropriate to the moment
    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
    expect(html).toContain("better than yesterday, together.");
    expect(html).toContain("Thanks for rolling with us");
    // Single arrowed CTA
    expect(html).toContain("Find another session &rarr;");
  });

  test("each reason has a distinct headline + body without 'Tomorrow' assumption", () => {
    for (const reason of ["weather", "venue", "low-enrollment", "other"] as const) {
      const html = sessionCancelledHtml({ ...cancelSample, reason });
      expect(html).not.toMatch(/Tomorrow's session is off/);
    }
    // Spot-check each variant's body
    expect(sessionCancelledHtml({ ...cancelSample, reason: "venue" })).toContain(
      "Venue issue — this session is off.",
    );
    expect(
      sessionCancelledHtml({ ...cancelSample, reason: "low-enrollment" }),
    ).toContain("rescheduling");
    expect(sessionCancelledHtml({ ...cancelSample, reason: "other" })).toContain(
      "this session is cancelled",
    );
  });

  test("optional Coach note renders when provided + omitted when blank", () => {
    const withNote = sessionCancelledHtml({
      ...cancelSample,
      reason: "weather",
      note: "Lightning in the forecast. I'll see you Saturday.",
    });
    expect(withNote).toContain("Lightning in the forecast");

    const noNote = sessionCancelledHtml({ ...cancelSample, reason: "weather" });
    expect(noNote).not.toContain("Lightning");
  });

  test("plain-text fallback: parity on refund framing, signoff, schedule URL", () => {
    const text = sessionCancelledText({ ...cancelSample, reason: "weather" });
    expect(text).toContain("Weather call");
    expect(text).toContain("Your $40.00 is on the way back.");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("better than yesterday, together.");
    expect(text).toContain("Find another session: https://www.nextgenpbacademy.com/schedule");
  });

  test("SMS body: kid name first, refund cue, Coach Sam, STOP language, 1-segment friendly", () => {
    const sms = sessionCancelledSms({
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionDateShort: "Sat May 23",
      scheduleUrl: "https://www.nextgenpbacademy.com/schedule",
    });
    expect(sms.startsWith("Riley's Green Ball Drop-in")).toBe(true);
    expect(sms).toContain("Full refund issued");
    expect(sms).toContain("— Coach Sam · NGA");
    expect(sms).toContain("Reply STOP to opt out.");
  });
});

test.describe("Comms templates — post-session re-book", () => {
  const post = {
    parentFirst: "Alex",
    childFirst: "Riley",
    sessionTitle: "Green Ball Drop-in",
    sessionDateLong: "Saturday, May 23, 2026",
    scheduleUrl: "https://www.nextgenpbacademy.com/schedule",
  };

  test("HTML: kid-name headline, EASE-Skills framing, Coach Sam signoff, single arrowed CTA", () => {
    const html = postSessionHtml(post);
    // Opens with kid name doing something concrete
    expect(html).toContain("Riley got reps in yesterday.");
    // EASE-Skills: "consistency beats intensity," pathway language, real-progress framing
    expect(html).toContain("Real progress is built one session at a time");
    expect(html).toContain("consistency beats intensity");
    expect(html).toContain("pathway moving");
    // Coach Sam signoff + tagline
    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
    expect(html).toContain("Better than yesterday, together.");
    // Single arrowed CTA = next session. No competing arrows.
    expect(html).toContain("See the next session &rarr;");
    // Politeness opt-out cue
    expect(html).toContain("reply &ldquo;skip&rdquo;");
  });

  test("HTML: no gated pickleball jargon to parents (no bare 'dink', 'reset', 'third shot', etc.)", () => {
    const html = postSessionHtml(post);
    // Brand-rule check. "Dinking" in the rendered output without a parent
    // gloss is a violation — bare jargon is banned for parent-facing copy.
    expect(html.toLowerCase()).not.toMatch(/dinking|\bdink\b/);
    expect(html.toLowerCase()).not.toMatch(/third shot|\berne\b|\batp\b/);
  });

  test("plain-text fallback: parity on headline, pathway list, signoff, skip-cue", () => {
    const text = postSessionText(post);
    expect(text).toContain("Riley got reps in yesterday.");
    expect(text).toContain("consistency beats intensity");
    expect(text).toContain("See the next session: https://www.nextgenpbacademy.com/schedule");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("Better than yesterday, together.");
    expect(text).toContain('reply "skip"');
  });
});
