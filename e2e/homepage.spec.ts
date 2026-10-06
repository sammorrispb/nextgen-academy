import { test, expect } from "@playwright/test";

// ─── Hero Section ─────────────────────────────────

test.describe("Hero", () => {
  test("has primary Text for a Free 30-Minute Evaluation CTA linking to SMS", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("section").first().getByRole("link", { name: /Text for a Free 30-Minute Evaluation/ });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", "sms:+13013254731");
  });

  test("has secondary schedule link", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("section").first().getByRole("link", { name: /Already evaluated\? See the schedule/ });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", "/schedule");
  });
});

// ─── How It Works (PR 1) ──────────────────────────

test.describe("How It Works", () => {
  test("shows 3 steps distinguishing evaluations, drop-ins and seasons", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#how-it-works");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "Free evaluation" })).toBeVisible();
    await expect(section.getByRole("heading", { name: "Choose your program" })).toBeVisible();
    await expect(section.getByRole("heading", { name: "Move up the pathway" })).toBeVisible();
    await expect(section).toContainText(/drop-in/i);
    await expect(section).toContainText(/paid up front/i);
    await expect(section.getByRole("link", { name: /see leagues and seasons/i })).toHaveAttribute("href", "/league");
    await expect(section).not.toContainText(/drop-in only/i);
  });
});

test.describe("program discovery consistency", () => {
  test("the drop-in feed does not imply other programs are closed", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("region", { name: /Montgomery County Public Schools/ });
    await expect(strip).toContainText(/drop-in/i);
    await expect(strip.getByRole("link", { name: /see leagues and seasons/i })).toHaveAttribute("href", "/league");
    await expect(strip).not.toContainText("No sessions open this week.");
    const heading = strip.getByRole("heading", { name: "No drop-in sessions are listed right now." });
    if (await heading.count()) await expect(heading).toBeVisible();
  });

  test("Bethesda describes the actual Green and Yellow season and offers other on-ramps", async ({ page }) => {
    await page.goto("/youth-pickleball-bethesda");
    const intro = page.locator("h1").locator("..");
    await expect(intro).toContainText("Green Ball");
    await expect(intro).toContainText("Yellow Ball");
    await expect(intro).toContainText(/paid up front/i);
    await expect(intro).not.toContainText(/court for every level|then drop in/i);
    await expect(page.getByRole("link", { name: "Fall season details", exact: true })).toHaveAttribute("href", "/fall");
    await expect(page.locator("body")).toContainText(/each program.*ages and levels/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("Frederick heading agrees with its single ages 8–13 league card", async ({ page }) => {
    await page.goto("/youth-pickleball-frederick");
    const leagues = page.locator("#leagues");
    await expect(leagues.getByRole("heading", { level: 2 })).toHaveText("1 Saturday youth league at The Pickl Park.");
    await expect(leagues.locator("article")).toHaveCount(1);
    await expect(leagues).toContainText("Ages 8–13");
    await expect(leagues).not.toContainText(/Two Saturday|Youth League 3:/i);
    const partnerListing = leagues.getByRole("link", { name: /Register with The Pickl Park|See the listing at The Pickl Park/ });
    if (await partnerListing.count()) {
      await expect(partnerListing).toHaveAttribute(
        "href", "https://thepicklpark.podplay.app/community/events/01a07d03-9f72-744f-a80c-6284f8f60fd5",
      );
    } else {
      await expect(leagues.getByRole("link", { name: "This season has finished — get the next one by email" })).toHaveAttribute("href", "/newsletter");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

// ─── Upcoming Sessions (PR 3) ─────────────────────

test.describe("Upcoming Sessions strip", () => {
  test("renders the heading and either sessions or empty-state waitlist", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: /Montgomery County Public Schools/ });
    await expect(section).toBeVisible();
    // Renders EITHER session cards + 'See all upcoming sessions' link
    // OR the EmptyStateWaitlist form (PR 5).
    const seeAll = section.getByRole("link", { name: /See all upcoming sessions/ });
    const waitlistBtn = section.getByRole("button", { name: /Add me to the waitlist/ });
    const hasEither = (await seeAll.count()) > 0 || (await waitlistBtn.count()) > 0;
    expect(hasEither).toBe(true);
  });
});

// ─── Waitlist API (PR 5) ──────────────────────────

test.describe("Waitlist API", () => {
  test("rejects empty body with 400 + validation errors", async ({ request }) => {
    const res = await request.post("/api/waitlist", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.errors.parentName).toBeTruthy();
    expect(json.errors.contact).toBeTruthy();
    expect(json.errors.preferredArea).toBeTruthy();
  });

  test("rejects unknown preferredArea", async ({ request }) => {
    const res = await request.post("/api/waitlist", {
      data: {
        parentName: "Test Parent",
        contact: "test@example.com",
        preferredArea: "Mars",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.errors.preferredArea).toBe("Invalid area");
  });
});

test.describe("Notion Session Webhook", () => {
  test("rejects requests without the shared secret", async ({ request }) => {
    const res = await request.post("/api/notion-session-webhook", {
      data: {
        sessionTitle: "Test",
        sessionDate: "2026-06-01",
        sessionLocation: "Sherwood HS",
      },
      headers: { "Content-Type": "application/json" },
    });
    // Either 401 (secret set, didn't match) or 503 (secret not configured) —
    // both are safe responses that prove the endpoint won't fire emails
    // without auth.
    expect([401, 503]).toContain(res.status());
  });
});

// ─── Coach Strip (PR 2) ───────────────────────────

test.describe("Coach Strip", () => {
  test("shows both coaches above the fold with tagline", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("region", { name: /Sam and Amine/ });
    await expect(strip).toBeVisible();
    await expect(strip.getByText("Sam Morris")).toBeVisible();
    await expect(strip.getByText("Amine Lahlou")).toBeVisible();
    await expect(strip.getByText(/Former PE teacher/)).toBeVisible();
    await expect(strip.getByText(/Tennis coach/)).toBeVisible();
    await expect(strip.getByText("Built by parents, for parents.")).toBeVisible();
  });
});

// ─── Ball Pathway ─────────────────────────────────

test.describe("Ball Pathway", () => {
  test("desktop pathway is horizontal @desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    await page.goto("/");
    // The desktop pathway container (hidden on mobile, flex on sm+)
    const desktopPathway = page.locator("#levels >> css=.hidden.sm\\:flex");
    await expect(desktopPathway).toBeVisible();
    const pathwayText = await desktopPathway.textContent();
    // Post-2026-06-18: all four ball colors run their own group court, so the
    // pathway shows a ball-color label next to each colored ball.
    expect(pathwayText).toContain("Red Ball");
    expect(pathwayText).toContain("Orange Ball");
    expect(pathwayText).toContain("Green Ball");
    expect(pathwayText).toContain("Yellow Ball");
    // PR #94 (2026-05-24) realigned the floor from 8+ back to 6+.
    expect(pathwayText).toContain("Ages 6+");
    expect(pathwayText).toContain("Ages 10+");
    expect(pathwayText).toContain("Ages 12+");
  });

  test("mobile pathway is vertical @mobile", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") test.skip();
    await page.goto("/");
    const mobilePathway = page.locator("#levels >> css=.sm\\:hidden");
    await expect(mobilePathway).toBeVisible();
    const pathwayText = await mobilePathway.textContent();
    expect(pathwayText).toContain("Red Ball");
    expect(pathwayText).toContain("Orange Ball");
    expect(pathwayText).toContain("Green Ball");
    expect(pathwayText).toContain("Yellow Ball");
    // PR #94 (2026-05-24) realigned the floor from 8+ back to 6+.
    expect(pathwayText).toContain("Ages 6+");
    expect(pathwayText).toContain("Ages 10+");
    expect(pathwayText).toContain("Ages 12+");
  });
});

// ─── Level Cards ──────────────────────────────────

test.describe("Level Cards", () => {
  test("shows 4 level cards with no pricing", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("#levels article");
    await expect(cards).toHaveCount(4);

    for (let i = 0; i < 4; i++) {
      const cardText = await cards.nth(i).textContent();
      expect(cardText).not.toContain("drop-in");
      expect(cardText).not.toContain("/season");
    }
  });

  test("cards show correct age badges", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("#levels article");
    const firstCardText = await cards.first().textContent();
    // 2026-05-13 lifted the floor from 5+ to 8+; PR #94 (2026-05-24)
    // realigned to 6+ as the canonical academy floor.
    expect(firstCardText).toContain("Ages 6+");
    // Each subsequent level has a higher floor.
    expect(await cards.nth(2).textContent()).toContain("Ages 10+");
    expect(await cards.nth(3).textContent()).toContain("Ages 12+");
  });

  test("non-yellow cards have Get Started links", async ({ page }) => {
    await page.goto("/");
    const getStartedLinks = page.locator('#levels article a[href="sms:+13013254731"]');
    // Red, Orange, Green = 3 cards with Get Started
    await expect(getStartedLinks).toHaveCount(3);
  });

  test("yellow card shows Invite Only", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#levels").getByText("Invite Only")).toBeVisible();
  });
});

// ─── Yellow Ball CTA ──────────────────────────────

test.describe("Yellow Ball CTA", () => {
  // Yellow Ball is invite-only with custom scheduling — the drop-in rate never
  // applied to it, so the card quotes no price at all (Sam, 2026-09-08).
  test("quotes no price", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("yellowball-cta");
    await expect(card).toBeVisible();
    await expect(card).not.toContainText("$");
    await expect(card).not.toContainText(/per 1-hour/i);
  });

  test("links to the inquiry page", async ({ page }) => {
    await page.goto("/");
    const cta = page
      .getByRole("link", { name: /Request an eval/i })
      .first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/yellowball/inquiry");
  });
});

// ─── EASE + Testimonials + Coaches ────────────────

test.describe("EASE section", () => {
  test("shows all 4 EASE values", async ({ page }) => {
    await page.goto("/");
    const ease = page.locator("#ease");
    await expect(ease.getByText("Ethics")).toBeVisible();
    await expect(ease.getByText("Attitude")).toBeVisible();
    await expect(ease.getByText("Skills")).toBeVisible();
    await expect(ease.getByText("Excellence")).toBeVisible();
  });

  test("shows Define Demonstrate Drill", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#ease").getByText(/Define.*Demonstrate.*Drill/)).toBeVisible();
  });
});

test.describe("Testimonials", () => {
  const routes = [
    "/",
    "/free-evaluation",
    "/montgomery-county-youth-pickleball",
    "/youth-pickleball-bethesda",
    "/youth-pickleball-north-bethesda",
    "/youth-pickleball-rockville",
    "/youth-pickleball-potomac",
    "/youth-pickleball-gaithersburg",
    "/youth-pickleball-germantown",
    "/youth-pickleball-silver-spring",
    "/youth-pickleball-olney",
  ];

  for (const route of routes) {
    test(`${route} withholds unverified quotes and keeps evaluation discovery`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("blockquote")).toHaveCount(0);
      await expect(page.locator("#testimonials")).toHaveCount(0);
      await expect(page.getByRole("heading", {
        name: /What (Next Gen|MoCo|Montgomery County) (families|parents) (say|are saying)/,
      })).toHaveCount(0);
      await expect(page.getByText("Parent Stories", { exact: true })).toHaveCount(0);
      const evaluation = page.getByRole("link", { name: /Text.*(Evaluation|schedule)/i }).first();
      await expect(evaluation).toBeVisible();
      await expect(evaluation).toHaveAttribute("href", "sms:+13013254731");
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});

test.describe("Coaches / About", () => {
  test("shows both coaches", async ({ page }) => {
    await page.goto("/");
    const about = page.locator("#about");
    await expect(about.getByRole("heading", { name: "Sam Morris" })).toBeVisible();
    await expect(about.getByRole("heading", { name: "Amine Lahlou" })).toBeVisible();
  });

  test("shows Parent-Coach-Kid Triangle mention", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#about").getByText(/Parent.*Coach.*Kid Triangle/)).toBeVisible();
  });
});

// ─── Contact Form (homepage anchor) ───────────────
// Full Contact Form coverage lives in e2e/contact-form.spec.ts.
// These smoke tests just confirm the homepage anchor still renders a form
// with the canonical fields so anything linking to #contact-form keeps working.

test.describe("Contact Form (homepage anchor)", () => {
  test("renders with name, email, and interest fields", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await expect(form.locator("#name")).toBeVisible();
    await expect(form.locator("#email")).toBeVisible();
    await expect(form.locator("#interest")).toBeVisible();
  });
});

// ─── FAQ ──────────────────────────────────────────

test.describe("FAQ", () => {
  test("shows all FAQ items", async ({ page }) => {
    await page.goto("/");
    const faqSection = page.locator("#faq");
    const questions = faqSection.locator('button[aria-expanded]');
    // faq.ts currently has 12 items; assert >= 6 so the test isn't brittle to copy edits
    expect(await questions.count()).toBeGreaterThanOrEqual(6);
  });

  test("accordion expands and collapses", async ({ page }) => {
    await page.goto("/");
    const faqSection = page.locator("#faq");
    const firstQuestion = faqSection.locator('button[aria-expanded]').first();

    await expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
    await firstQuestion.click();
    await expect(firstQuestion).toHaveAttribute("aria-expanded", "true");
    await firstQuestion.click();
    await expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
  });

  test("shows still have questions footer with contact options", async ({ page }) => {
    await page.goto("/");
    const faqSection = page.locator("#faq");
    await expect(faqSection.getByText("Still have questions?")).toBeVisible();
    // Match the call-or-text link directly — FAQ answer copy also contains the phone number.
    await expect(
      faqSection.getByRole("link", { name: /Call or text 301-325-4731/ })
    ).toBeVisible();
    await expect(faqSection.getByRole("link", { name: "Email us", exact: true })).toBeVisible();
  });
});

// ─── Contact Strip ────────────────────────────────

test.describe("Contact Strip", () => {
  test("shows email, phone, Instagram", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(contact.getByRole("link", { name: "Email" })).toBeVisible();
    await expect(contact.getByRole("link", { name: /301-325-4731/ })).toBeVisible();
    await expect(contact.getByRole("link", { name: "Instagram" })).toBeVisible();
  });

  // The group used to be the 4th pill here, labelled just "WhatsApp" — a social
  // icon, not an ask. It is now a labelled CTA card above the strip, so the
  // invite is NOT also a pill: one link per group per section.
  test("carries the community-groups CTA, not a bare WhatsApp pill", async ({
    page,
  }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(
      contact.getByRole("link", { name: /Join Next Gen parents on WhatsApp/i }),
    ).toBeVisible();
    await expect(
      contact.getByRole("link", { name: /Link & Dink on WhatsApp/i }),
    ).toBeVisible();
    // `exact` matters: the default substring match would happily match the two
    // CTAs above and never catch the pill coming back.
    await expect(
      contact.getByRole("link", { name: "WhatsApp", exact: true }),
    ).toHaveCount(0);
  });

  test("shows MCPS framing in contact panel", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(
      contact.getByText("Your closest court, every week.")
    ).toBeVisible();
    await expect(
      contact.getByText(/Montgomery County Public Schools/)
    ).toBeVisible();
  });
});

// ─── Sticky Mobile CTA ───────────────────────────

test.describe("Sticky Mobile CTA", () => {
  test("visible on mobile @mobile", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") test.skip();
    await page.goto("/");
    const sticky = page.locator(".fixed.bottom-0");
    await expect(sticky).toBeVisible();
    await expect(sticky.getByText("Text for an Evaluation")).toBeVisible();
  });

  test("hidden on desktop @desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    await page.goto("/");
    const sticky = page.locator(".fixed.bottom-0");
    await expect(sticky).toBeHidden();
  });
});

// ─── Navigation ───────────────────────────────────

test.describe("Nav links", () => {
  test("desktop navbar has correct links on homepage @desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Start Here" })).toHaveAttribute("href", "#start");
    await expect(nav.getByRole("link", { name: "Leagues", exact: true })).toHaveAttribute("href", "/league");
    await expect(nav.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/schedule");
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", "#about");
  });

  test("mobile navbar shows links when hamburger is tapped @mobile", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") test.skip();
    await page.goto("/");
    // Open hamburger menu
    await page.getByLabel("Toggle menu").click();
    const menu = page.locator("#mobile-menu");
    await expect(menu.getByRole("link", { name: "Start Here" })).toHaveAttribute("href", "#start");
    await expect(menu.getByRole("link", { name: "Leagues", exact: true })).toHaveAttribute("href", "/league");
    await expect(menu.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/schedule");
  });

  test("/schedule page loads", async ({ page }) => {
    await page.goto("/schedule");
    await expect(
      page.getByRole("heading", {
        name: /Youth Pickleball Schedule.*Montgomery County, MD/,
      })
    ).toBeVisible();
  });

  test("navbar links prefix with / on schedule page @desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    await page.goto("/schedule");
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Start Here" })).toHaveAttribute("href", "/#start");
  });
});

// ─── Redirects ────────────────────────────────────

test.describe("Redirects", () => {
  for (const { from, to } of [
    { from: "/programs", to: "/#levels" },
    { from: "/about", to: "/#about" },
    { from: "/faq", to: "/#faq" },
    { from: "/contact", to: "/#contact" },
    { from: "/free-trial", to: "/free-evaluation" },
  ]) {
    test(`${from} redirects to ${to}`, async ({ page, baseURL }) => {
      const response = await page.goto(from, { waitUntil: "domcontentloaded" });
      // Check both the destination and fragment on whichever isolated server
      // the configuration provides; a redirect to the wrong section must fail.
      await expect(page).toHaveURL(new URL(to, baseURL).href);
      expect(response?.status()).toBeLessThan(400);
    });
  }
});
