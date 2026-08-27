import { test, expect } from "@playwright/test";

import {
  fallSeasonHowItWorksHtml,
  fallSeasonHowItWorksSubject,
  fallSeasonHowItWorksText,
  type FallSeasonHowItWorksInput,
} from "../src/lib/email/fall-season-how-it-works";
import {
  fallSeasonWeekNoteHtml,
  fallSeasonWeekNoteSubject,
  fallSeasonWeekNoteText,
  type FallSeasonWeekNoteInput,
} from "../src/lib/email/fall-season-week-note";
import {
  fallSeasonCaptainAskHtml,
  fallSeasonCaptainAskSubject,
  fallSeasonCaptainAskText,
  type FallSeasonCaptainAskInput,
} from "../src/lib/email/fall-season-captain-ask";
import {
  WHATSAPP_LD_GROUP_URL,
  WHATSAPP_NGA_GROUP_URL,
} from "../src/lib/email/signature";

// Pure-function checks. No page navigation, no dev server. Run with:
//   npx playwright test e2e/fall-season-comms.spec.ts --project=desktop

const VENUE =
  "Earle B. Wood Middle School Tennis Courts, 14615 Bauer Dr, Rockville, MD 20853";
const MAPS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  VENUE,
)}`;

/** Mirrors the templates' own escaper, so copy assertions survive apostrophes. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const howItWorks: FallSeasonHowItWorksInput = {
  parentFirst: "Alex",
  childFirst: "Riley",
  groupLabel: "Green Ball",
  timeLabel: "1:00–2:30 PM",
  venue: VENUE,
  seasonLabel: "September 20 – October 25, 2026",
  weeks: [
    {
      week: 1,
      dateLong: "Sunday, September 20",
      title: "Where we're starting",
      parentLine: "We found out where every kid is starting.",
    },
    {
      week: 2,
      dateLong: "Sunday, September 27",
      title: "The soft game",
      parentLine: "We worked the Slinky.",
    },
  ],
  rules: {
    label: "Green Ball",
    serve: "One serve, from behind the baseline.",
    kitchen: "ON, standard. Faults are called.",
    scoring: "Rally scoring to 9, win by 1.",
  },
  rainDates: ["Sunday, November 1", "Sunday, November 8"],
};

const weekNote: FallSeasonWeekNoteInput = {
  variant: "preview",
  parentFirst: "Alex",
  childFirst: "Riley",
  week: 2,
  totalWeeks: 6,
  dateLong: "Sunday, September 27",
  title: "The soft game",
  focusName: "Transition",
  focusAlias: "The Slinky",
  parentLine: "We worked the Slinky — dinking, then stepping back a step at a time.",
  word: "Skills",
  wordFraming: "Smart beats strong.",
  homeRep: "Bounce the ball on the paddle, low and controlled, twenty in a row.",
  groupLabel: "Green Ball",
  timeLabel: "1:00–2:30 PM",
  venue: VENUE,
};

const captainAsk: FallSeasonCaptainAskInput = {
  parentFirst: "Alex",
  groupLabel: "Green Ball",
  timeLabel: "1:00–2:30 PM",
  arriveEarlyMinutes: 15,
  sundays: ["Sunday, September 20", "Sunday, September 27"],
  playbookUrl: "https://nextgenpbacademy.com/coach/fall-playbook",
};

/** Every recipient-facing body, HTML and text, for the shared-rule sweeps. */
const allBodies: Array<{ name: string; html: string; text: string }> = [
  {
    name: "how-it-works",
    html: fallSeasonHowItWorksHtml(howItWorks),
    text: fallSeasonHowItWorksText(howItWorks),
  },
  {
    name: "week-note (preview)",
    html: fallSeasonWeekNoteHtml(weekNote),
    text: fallSeasonWeekNoteText(weekNote),
  },
  {
    name: "week-note (recap)",
    html: fallSeasonWeekNoteHtml({ ...weekNote, variant: "recap" }),
    text: fallSeasonWeekNoteText({ ...weekNote, variant: "recap" }),
  },
  {
    name: "captain-ask",
    html: fallSeasonCaptainAskHtml(captainAsk),
    text: fallSeasonCaptainAskText(captainAsk),
  },
];

test.describe("brand standards hold across every season email", () => {
  for (const { name, html, text } of allBodies) {
    test(`${name} carries the Coach Sam signoff in both parts`, () => {
      expect(html).toContain("Coach Sam");
      expect(html).toContain("Next Gen Pickleball Academy");
      expect(text).toContain("Coach Sam · Next Gen Pickleball Academy");
      // Never the bare-name forms the brand guide bans.
      expect(text).not.toMatch(/^Sam Morris—Head Coach$/m);
    });

    test(`${name} carries a tagline or EASE line above the signature`, () => {
      expect(html.toLowerCase()).toContain("better than yesterday");
      expect(text.toLowerCase()).toContain("better than yesterday");
    });

    test(`${name} carries both community invites (signatureExtras)`, () => {
      expect(html).toContain(WHATSAPP_NGA_GROUP_URL);
      expect(html).toContain(WHATSAPP_LD_GROUP_URL);
      expect(text).toContain(WHATSAPP_NGA_GROUP_URL);
      expect(text).toContain(WHATSAPP_LD_GROUP_URL);
    });

    // These go to families who have ALREADY paid $225. A dollar figure in a
    // post-purchase season email is at best noise and at worst a second,
    // contradictory number — the confirmation email owns the price.
    test(`${name} quotes no dollar figure`, () => {
      expect(html).not.toMatch(/\$\s?\d/);
      expect(text).not.toMatch(/\$\s?\d/);
    });

    test(`${name} escapes injected markup rather than rendering it`, () => {
      expect(html).not.toContain("<script>");
    });
  }
});

test.describe("how-it-works — the season primer", () => {
  const html = fallSeasonHowItWorksHtml(howItWorks);
  const text = fallSeasonHowItWorksText(howItWorks);

  test("subject names the child", () => {
    expect(fallSeasonHowItWorksSubject("Riley")).toContain("Riley");
  });

  test("describes the whole shape of a Sunday, in order", () => {
    for (const phase of [
      "Arrival rally",
      "Huddle",
      "Skill Stack",
      "Modified games",
      "Round robin",
      "Jailbreak",
    ]) {
      expect(html, phase).toContain(phase);
      expect(text, phase).toContain(phase);
    }
  });

  test("every week passed in appears in both parts", () => {
    for (const week of howItWorks.weeks) {
      // The HTML builder escapes, so compare against the escaped form there —
      // asserting the raw string would pass only for titles with no apostrophe.
      expect(html).toContain(escapeHtml(week.title));
      expect(html).toContain(escapeHtml(week.dateLong));
      expect(html).toContain(escapeHtml(week.parentLine));
      expect(text).toContain(week.title);
      expect(text).toContain(week.parentLine);
    }
  });

  test("states the rules this child plays under", () => {
    expect(html).toContain(howItWorks.rules.serve);
    expect(html).toContain(howItWorks.rules.kitchen);
    expect(text).toContain(howItWorks.rules.scoring);
  });

  // Plain-text fallback parity: the brand guide requires the maps URL and a
  // scannable what-to-bring list, not a comma-joined sentence.
  test("plain text mirrors the maps link and keeps the bring-list scannable", () => {
    expect(html).toContain(MAPS);
    expect(text).toContain(MAPS);
    expect(text).toContain("- Refillable water bottle");
    expect(text).toContain("- Court shoes");
  });

  test("sets the sideline norms without turning them into rules with teeth", () => {
    const lower = text.toLowerCase();
    expect(lower).toContain("i love watching you play");
    expect(lower).toContain("cheer for every kid");
    expect(lower).toContain("line calls");
  });

  test("promises a rain decision rather than telling parents to guess", () => {
    expect(text).toContain("Sunday, November 1");
    expect(text.toLowerCase()).toContain("by noon");
  });
});

test.describe("week note — preview and recap", () => {
  test("subjects differ and both name the week", () => {
    const preview = fallSeasonWeekNoteSubject(weekNote);
    const recap = fallSeasonWeekNoteSubject({ ...weekNote, variant: "recap" });
    expect(preview).not.toBe(recap);
    expect(preview).toContain("week 2");
    expect(recap).toContain("Week 2");
    expect(recap).toContain("Riley");
  });

  test("preview gives tonight's rep and the directions link", () => {
    const html = fallSeasonWeekNoteHtml(weekNote);
    const text = fallSeasonWeekNoteText(weekNote);
    expect(html).toContain("Five minutes tonight");
    expect(html).toContain(MAPS);
    expect(text).toContain("FIVE MINUTES TONIGHT");
    expect(text).toContain(MAPS);
  });

  test("recap gives the car question and asks nothing of the parent", () => {
    const html = fallSeasonWeekNoteHtml({ ...weekNote, variant: "recap" });
    const text = fallSeasonWeekNoteText({ ...weekNote, variant: "recap" });
    expect(html).toContain("Ask them in the car");
    expect(html).toContain("The Slinky");
    expect(text).toContain("ASK THEM IN THE CAR");
    // No primary CTA on a recap — nothing is being asked, so no maps link.
    expect(html).not.toContain(MAPS);
    expect(text).not.toContain(MAPS);
  });

  test("both variants carry the same week's word of the day", () => {
    for (const variant of ["preview", "recap"] as const) {
      const text = fallSeasonWeekNoteText({ ...weekNote, variant });
      expect(text, variant).toContain("WORD OF THE DAY: Skills");
      expect(text, variant).toContain(weekNote.wordFraming);
      expect(text, variant).toContain(weekNote.homeRep);
    }
  });
});

test.describe("captain ask — the volunteer recruitment email", () => {
  const html = fallSeasonCaptainAskHtml(captainAsk);
  const text = fallSeasonCaptainAskText(captainAsk);

  test("subject lowers the barrier rather than raising it", () => {
    expect(fallSeasonCaptainAskSubject().toLowerCase()).toContain("captain");
  });

  // The single most important thing this email does: make clear the job is not
  // coaching. A parent who says yes thinking otherwise will coach, and may
  // teach against what the coach said a minute earlier.
  test("states plainly that captains do not coach and need no pickleball background", () => {
    for (const body of [html, text]) {
      expect(body.toLowerCase()).toContain("what you would not do");
      expect(body).toContain("Coach, can you look at this?");
      expect(body.toLowerCase()).toContain("do not need to have played pickleball");
    }
  });

  test("names the four duties the role actually is", () => {
    for (const body of [html, text]) {
      const lower = body.toLowerCase();
      expect(lower).toContain("timer");
      expect(lower).toContain("rotation");
      expect(lower).toContain("score");
      expect(lower).toContain("caddy");
    }
  });

  // Safeguarding is stated up front, not buried. A volunteer surprised by
  // vetting later is a volunteer lost at the worst possible moment.
  test("states the background check and the two-adult rule in both parts", () => {
    for (const body of [html, text]) {
      const lower = body.toLowerCase();
      expect(lower).toContain("background check");
      expect(lower).toContain("two adults present");
      expect(lower).toMatch(/(never|no adult is ever) alone with a child/);
      expect(lower).toContain("line of sight");
    }
  });

  test("lists every Sunday offered and links the full playbook", () => {
    for (const sunday of captainAsk.sundays) {
      expect(html).toContain(sunday);
      expect(text).toContain(`- ${sunday}`);
    }
    expect(html).toContain(captainAsk.playbookUrl);
    expect(text).toContain(captainAsk.playbookUrl);
  });

  test("gives a graceful no — no dark pattern, no follow-up threat", () => {
    for (const body of [html, text]) {
      expect(body.toLowerCase()).toContain("no follow-up");
    }
  });
});

test.describe("hostile input is escaped, not rendered", () => {
  const nasty = '<script>alert("x")</script>';

  test("a child name carrying markup can't break out into the HTML body", () => {
    const html = fallSeasonHowItWorksHtml({ ...howItWorks, childFirst: nasty });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("the same holds for the week note and the captain ask", () => {
    const week = fallSeasonWeekNoteHtml({ ...weekNote, childFirst: nasty, title: nasty });
    expect(week).not.toContain("<script>");
    const ask = fallSeasonCaptainAskHtml({ ...captainAsk, parentFirst: nasty });
    expect(ask).not.toContain("<script>");
  });
});
