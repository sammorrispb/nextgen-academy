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
import {
  postSessionRebookHtml,
  postSessionRebookText,
} from "../src/lib/email/post-session-rebook";
import {
  cancelConfirmationHtml,
  cancelConfirmationText,
} from "../src/lib/email/cancel-confirmation";
import {
  bookingConfirmationSms,
  bookingReminderSms,
  cancelConfirmationSms,
  sessionCancelledSms,
} from "../src/lib/sms";

const sample = {
  parentFirst: "Alex",
  childFirst: "Riley",
  sessionTitle: "Green Ball Drop-in",
  sessionDateLong: "Saturday, May 23, 2026",
  sessionStart: "5:30 PM",
  sessionLocation: "Cabin John RP, Bethesda MD",
  detailUrl: "https://nextgenpbacademy.com/schedule/green-ball-drop-in-2026-05-23",
};
const cancelUrl =
  "https://nextgenpbacademy.com/schedule/cancel?token=signed.token.here";

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
    expect(sms).toContain("- Coach Sam, NGA");
    expect(sms).toContain("Reply STOP to opt out.");
    // GSM-7 cost discipline: no em-dash, no middot, no en-dash.
    expect(sms).not.toMatch(/[—·–]/);
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
    scheduleUrl: "https://nextgenpbacademy.com/schedule",
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
    expect(text).toContain("Find another session: https://nextgenpbacademy.com/schedule");
  });

  test("SMS body: kid name first, refund cue, Coach Sam, STOP language, 1-segment friendly", () => {
    const sms = sessionCancelledSms({
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionDateShort: "Sat May 23",
      scheduleUrl: "https://nextgenpbacademy.com/schedule",
    });
    expect(sms.startsWith("Riley's Green Ball Drop-in")).toBe(true);
    expect(sms).toContain("Full refund issued");
    expect(sms).toContain("- Coach Sam, NGA");
    expect(sms).toContain("Reply STOP to opt out.");
    expect(sms).not.toMatch(/[—·–]/);
  });
});

test.describe("Comms templates — post-session re-book", () => {
  const post = {
    parentFirst: "Alex",
    childFirst: "Riley",
    sessionTitle: "Green Ball Drop-in",
    sessionDateLong: "Saturday, May 23, 2026",
    scheduleUrl: "https://nextgenpbacademy.com/schedule",
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
    expect(text).toContain("See the next session: https://nextgenpbacademy.com/schedule");
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("Better than yesterday, together.");
    expect(text).toContain('reply "skip"');
  });
});

test.describe("Comms templates — cancellation confirmation (per-row)", () => {
  const baseCancel = {
    parentFirst: "Alex",
    childFirst: "Riley",
    sessionTitle: "Green Ball Drop-in",
    sessionDateLong: "Saturday, May 23, 2026",
    sessionStart: "5:30 PM",
    amountUsd: "40.00",
    scheduleUrl: "https://nextgenpbacademy.com/schedule",
  };

  test("Refunded variant: leads with refund cue, EASE-Community, single arrowed CTA, Coach Sam signoff", () => {
    const html = cancelConfirmationHtml({ ...baseCancel, status: "Refunded" });
    // Refund-first headline
    expect(html).toContain("Riley&rsquo;s seat is cancelled.");
    expect(html).toContain("your $40.00 is on the way back");
    expect(html).toContain("Refund: $40.00");
    // Should NOT carry the non-refundable framing
    expect(html).not.toContain("Drop-ins are non-refundable");
    // Coach Sam + tagline + single arrowed CTA
    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
    expect(html).toContain("better than yesterday, together.");
    expect(html).toContain("See the schedule &rarr;");
  });

  test("Cancelled variant: leads with community framing, no-refund disclosure, no refund-line", () => {
    const html = cancelConfirmationHtml({ ...baseCancel, status: "Cancelled" });
    // Community-first headline (seat is open for next player)
    expect(html).toContain("Riley&rsquo;s seat is open for the next player.");
    expect(html).toContain("another family can grab the slot");
    // No-refund disclosure — leads with the rule, ends with the "thanks for
    // calling it early" community ack (no preachy "community version of a refund").
    expect(html).toContain("Drop-ins are non-refundable");
    expect(html).toContain("Thanks for calling it early");
    expect(html).not.toContain("community version of a refund");
    // Must NOT show the "Refund: $40.00" actionable callout
    expect(html).not.toContain("Refund: $40.00");
  });

  test("plain-text fallback (both variants): correct framing, no HTML entities leaking", () => {
    const refunded = cancelConfirmationText({ ...baseCancel, status: "Refunded" });
    expect(refunded).toContain("seat is cancelled");
    expect(refunded).toContain("$40.00 is on the way back");
    expect(refunded).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(refunded).not.toMatch(/&[a-z]+;/); // No raw HTML entities

    const cancelled = cancelConfirmationText({ ...baseCancel, status: "Cancelled" });
    expect(cancelled).toContain("seat is open for the next player");
    expect(cancelled).toContain("Drop-ins are non-refundable");
    expect(cancelled).not.toMatch(/&[a-z]+;/);
  });

  test("SMS variants: Refunded gets refund cue, Cancelled gets community cue; both 1-segment friendly with Coach Sam signoff", () => {
    const refundSms = cancelConfirmationSms({
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionDateShort: "Sat May 23",
      status: "Refunded",
      scheduleUrl: baseCancel.scheduleUrl,
    });
    expect(refundSms).toContain("Full refund issued");
    expect(refundSms).toContain("- Coach Sam, NGA");
    expect(refundSms).toContain("Reply STOP to opt out.");
    expect(refundSms).not.toMatch(/[—·–]/);

    const cancelSms = cancelConfirmationSms({
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionDateShort: "Sat May 23",
      status: "Cancelled",
      scheduleUrl: baseCancel.scheduleUrl,
    });
    expect(cancelSms).toContain("Seat is open for the next family");
    expect(cancelSms).not.toContain("Full refund");
    expect(cancelSms).toContain("- Coach Sam, NGA");
    expect(cancelSms).not.toMatch(/[—·–]/);
  });
});

test.describe("Comms SMS — GSM-7 segment-cost regression guard", () => {
  // Any non-GSM-7 char in an SMS body flips the entire message to UCS-2
  // encoding (70 chars/segment vs GSM-7's 160). That's a 3-4× per-send
  // cost hit. The sms.ts helpers throw in non-prod if a body slips —
  // this suite is the production-time guard.
  const GSM7_BASIC_RE =
    /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/;

  test("all 5 SMS bodies are GSM-7 clean (no em-dash, middot, en-dash, curly quotes, ellipsis)", () => {
    const samples = {
      childFirst: "Riley",
      sessionTitle: "Green Ball Drop-in",
      sessionStart: "5:30 PM",
      sessionDateShort: "Sat May 23",
      detailUrl: "https://nextgenpbacademy.com/schedule/green-ball-drop-in-2026-05-23",
      scheduleUrl: "https://nextgenpbacademy.com/schedule",
    };

    const bodies: Array<[string, string]> = [
      ["booking-confirmation", bookingConfirmationSms(samples)],
      ["booking-reminder", bookingReminderSms(samples)],
      ["session-cancelled", sessionCancelledSms(samples)],
      [
        "cancel-confirmation:Refunded",
        cancelConfirmationSms({ ...samples, status: "Refunded" }),
      ],
      [
        "cancel-confirmation:Cancelled",
        cancelConfirmationSms({ ...samples, status: "Cancelled" }),
      ],
    ];

    for (const [name, body] of bodies) {
      // Surface the offending char in the failure message so the fix is obvious.
      const offending = Array.from(body)
        .filter((ch) => !GSM7_BASIC_RE.test(ch))
        .filter((ch, i, a) => a.indexOf(ch) === i)
        .join("");
      expect(
        offending,
        `${name} SMS body contains non-GSM-7 chars: "${offending}"`,
      ).toBe("");
    }
  });
});

test.describe("Comms templates — post-session no-show rebook", () => {
  const rebook = {
    parentFirst: "Alex",
    childFirst: "Riley",
    sessionTitle: "Green Ball Drop-in",
    sessionDateLong: "Saturday, June 6, 2026",
    scheduleUrl: "https://nextgenpbacademy.com/schedule",
  };

  test("HTML is warm, blame-free, on-brand, single-CTA", () => {
    const html = postSessionRebookHtml(rebook);
    expect(html).toContain("We missed Riley on the court.");
    expect(html).toContain("life happens");
    expect(html).toContain("Grab the next session &rarr;");
    expect(html).toContain(rebook.scheduleUrl);
    // Signoff + tagline line.
    expect(html).toContain("Coach Sam &middot; Next Gen Pickleball Academy");
    expect(html).toContain("Better than yesterday, together.");
    // Must NOT carry the recap's "got reps" copy or the 4-week commit upsell.
    expect(html).not.toContain("got reps");
    expect(html).not.toContain("Lock in 4 weeks");
    expect(html).not.toContain("/commit/");
  });

  test("plain-text mirrors the HTML and the CTA URL", () => {
    const text = postSessionRebookText(rebook);
    expect(text).toContain("We missed Riley on the court.");
    expect(text).toContain("Grab the next session: " + rebook.scheduleUrl);
    expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
    expect(text).toContain("Better than yesterday, together.");
    expect(text).not.toContain("got reps");
  });

  test("escapes HTML in interpolated names", () => {
    const html = postSessionRebookHtml({ ...rebook, childFirst: "<b>Riley</b>" });
    expect(html).toContain("&lt;b&gt;Riley&lt;/b&gt;");
    expect(html).not.toContain("<b>Riley</b>");
  });
});
