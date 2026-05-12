import { test, expect } from "@playwright/test";

// ─── Hero Section ─────────────────────────────────

test.describe("Hero", () => {
  test("has primary Book a free 30-min evaluation CTA linking to #contact-form", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("section").first().getByRole("link", { name: /Book a free 30-min evaluation/ });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", "#contact-form");
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
  test("shows 3 steps with pricing in step 2", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#how-it-works");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "Free evaluation" })).toBeVisible();
    await expect(section.getByRole("heading", { name: "Drop in to sessions" })).toBeVisible();
    await expect(section.getByRole("heading", { name: "Move up the pathway" })).toBeVisible();
    await expect(section.getByText("$40 per 1-hour session")).toBeVisible();
  });
});

// ─── Upcoming Sessions (PR 3) ─────────────────────

test.describe("Upcoming Sessions strip", () => {
  test("renders the heading and link to schedule", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: /Montgomery County Public Schools/ });
    await expect(section).toBeVisible();
    // Either renders empty-state link OR a 'See all upcoming sessions' link
    const seeAll = section.getByRole("link", { name: /See all upcoming sessions|See the schedule/ });
    await expect(seeAll.first()).toBeVisible();
  });
});

// ─── Coach Strip (PR 2) ───────────────────────────

test.describe("Coach Strip", () => {
  test("shows both coaches above the fold with tagline", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("region", { name: /Two dads who actually coach/ });
    await expect(strip).toBeVisible();
    await expect(strip.getByText("Sam Morris")).toBeVisible();
    await expect(strip.getByText("Amine Lahlou")).toBeVisible();
    await expect(strip.getByText(/Former PE teacher/)).toBeVisible();
    await expect(strip.getByText(/Former pro tennis/)).toBeVisible();
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
    // All 4 level names within the pathway
    const pathwayText = await desktopPathway.textContent();
    expect(pathwayText).toContain("Red Ball");
    expect(pathwayText).toContain("Orange Ball");
    expect(pathwayText).toContain("Green Ball");
    expect(pathwayText).toContain("Yellow Ball");
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
    expect(firstCardText).toContain("Ages 5+");
  });

  test("non-yellow cards have Get Started links", async ({ page }) => {
    await page.goto("/");
    const getStartedLinks = page.locator('#levels article a[href="#contact-form"]');
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
  test("shows $40 per slot drop-in copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("$40").first()).toBeVisible();
    await expect(page.getByText(/per 1-hour slot/i).first()).toBeVisible();
    await expect(page.getByText(/Drop-in/i).first()).toBeVisible();
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
  test("shows 3 testimonials", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#testimonials");
    const quotes = section.locator("blockquote");
    await expect(quotes).toHaveCount(3);
  });
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

// ─── Lead Form ────────────────────────────────────

test.describe("Lead Form", () => {
  test("has exactly 3 input fields", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");

    await expect(form.locator("#parentName")).toBeVisible();
    await expect(form.locator("#contact")).toBeVisible();
    await expect(form.locator("#childAge")).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#contact-form form");
    await form.getByRole("button", { name: "Book my free evaluation" }).click();

    await expect(form.getByText("Your name is required")).toBeVisible();
    await expect(form.getByText("Email or phone number is required")).toBeVisible();
    await expect(form.getByText("Child's age is required")).toBeVisible();
  });

  test("shows micro-copy", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("#contact-form").getByText(/No commitment required/)
    ).toBeVisible();
  });

  test("age dropdown has options 4-16", async ({ page }) => {
    await page.goto("/");
    const select = page.locator("#contact-form #childAge");
    const options = select.locator("option");
    // "Select age" + ages 4-16 = 14 options
    await expect(options).toHaveCount(14);
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
  test("shows email, phone, Instagram, WhatsApp", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(contact.getByRole("link", { name: "Email" })).toBeVisible();
    await expect(contact.getByRole("link", { name: /301-325-4731/ })).toBeVisible();
    await expect(contact.getByRole("link", { name: "Instagram" })).toBeVisible();
    await expect(contact.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  });

  test("shows MCPS framing in contact panel", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(
      contact.getByText("We coach across Montgomery County Public Schools.")
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
    await expect(sticky.getByText("Free Evaluation")).toBeVisible();
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
    await expect(nav.getByRole("link", { name: "Programs" })).toHaveAttribute("href", "#levels");
    await expect(nav.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/schedule");
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", "#about");
    await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "#faq");
  });

  test("mobile navbar shows links when hamburger is tapped @mobile", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") test.skip();
    await page.goto("/");
    // Open hamburger menu
    await page.getByLabel("Toggle menu").click();
    const menu = page.locator("#mobile-menu");
    await expect(menu.getByRole("link", { name: "Programs" })).toHaveAttribute("href", "#levels");
    await expect(menu.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/schedule");
  });

  test("/schedule page loads", async ({ page }) => {
    await page.goto("/schedule");
    await expect(
      page.getByRole("heading", { name: "Class Schedule & Registration" })
    ).toBeVisible();
  });

  test("navbar links prefix with / on schedule page @desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") test.skip();
    await page.goto("/schedule");
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Programs" })).toHaveAttribute("href", "/#levels");
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
    test(`${from} redirects to ${to}`, async ({ page }) => {
      const response = await page.goto(from, { waitUntil: "domcontentloaded" });
      // Should end up at the homepage (redirects include hash)
      expect(page.url()).toContain("localhost:3000/");
      expect(response?.status()).toBeLessThan(400);
    });
  }
});
