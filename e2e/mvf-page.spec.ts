// Browser e2e for /montgomery-village-youth-pickleball. Requires `npm run dev`.
//   npx playwright test e2e/mvf-page.spec.ts
import { test, expect } from "@playwright/test";
import {
  MVF_PROGRAMS,
  MVF_REGISTRATION_SEARCH_URL,
  upcomingMvfPrograms,
} from "../src/data/mvf";

const PAGE_PATH = "/montgomery-village-youth-pickleball";

// The page publishes what a family can still register for, not the whole file.
// Deriving the expectation from the same helper the page uses is what keeps
// this spec honest as the season advances — a hardcoded list of five cards is
// exactly how the finished Aug 27 intro class stayed on the page into
// September. Lifecycle semantics are pinned separately, on injected dates, in
// e2e/mvf-programs.spec.ts.
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/New_York",
});
const LIVE = upcomingMvfPrograms(today);
const FINISHED = MVF_PROGRAMS.filter((p) => !LIVE.includes(p));

test.describe("/mvf-junior-tournament rain plan", () => {
  test("shows the conditional indoor venue and earlier hours before registration", async ({ page }) => {
    const response = await page.goto("/mvf-junior-tournament");
    expect(response?.status()).toBe(200);
    const plan = page.getByRole("region", { name: "Rain plan" });
    await expect(plan).toBeVisible();
    await expect(plan).toContainText("Lake Marion Community Center");
    await expect(plan).toContainText("8821 East Village Avenue, Montgomery Village, MD 20886");
    await expect(plan).toContainText("3:00–6:00 PM ET");
    await expect(plan).toContainText("one hour earlier than the outdoor schedule");
    await expect(plan).toContainText(/if it rains/i);
    await expect(plan).toContainText("Indoor check-in: 2:45 PM ET");
    await expect(page.getByText("Outdoor check-in: 3:45 PM ET.", { exact: true })).toBeVisible();
    const text = await page.locator("#main").innerText();
    expect(text).toContain("North Creek Community Center");
    expect(text).toContain("4:00–7:00 PM");
    expect(text).not.toContain("3:30 PM");
    const event = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((body) => JSON.parse(body)).find((value) => value["@type"] === "SportsEvent");
    expect(event.location.name).toBe("North Creek Community Center");
    expect(event.startDate).toBe("2026-10-24T16:00:00-04:00");
    expect(event.endDate).toBe("2026-10-24T19:00:00-04:00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("registration receipt repeats the rain plan without claiming payment", async ({ page }) => {
    await page.goto("/mvf-junior-tournament/success");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't verify your payment status");
    const main = page.locator("#main");
    await expect(main).toContainText("Lake Marion Community Center");
    await expect(main).toContainText("3:00–6:00 PM ET");
    await expect(main).toContainText("one hour earlier than the outdoor schedule");
    await expect(main).toContainText("Outdoor check-in: 3:45 PM ET");
    await expect(main).toContainText("Indoor check-in: 2:45 PM ET");
    await expect(main).not.toContainText("3:30 PM");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("/montgomery-village-youth-pickleball", () => {
  test("renders the hero h1 and MVF partnership line", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: /youth pickleball in\s+montgomery village/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/in partnership with the montgomery village foundation/i),
    ).toBeVisible();
  });

  test("renders every program card with its title, level, and MVF number", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    for (const program of LIVE) {
      const card = page.getByTestId(`mvf-program-${program.key}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(program.title);
      await expect(card).toContainText(program.levelLabel);
      // Parents match on the activity number in MVF's portal.
      await expect(card).toContainText(program.activityNumber);
    }
  });

  test("prices every live class, per class or per session as MVF sells it", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    for (const program of LIVE) {
      const card = page.getByTestId(`mvf-program-${program.key}`);
      for (const price of program.prices) {
        await expect(card).toContainText(`$${price.usd}`);
      }
      // The unit is the whole point: $8 is one evening, $90/$100 is a
      // six-week session. A card that shows the number without the unit is
      // what made the intro class read as the price of the program.
      await expect(card).toContainText(
        program.priceUnit === "class" ? "per class" : "per session",
      );
    }
  });

  test("a class that has already finished is published nowhere on the page", async ({
    page,
  }) => {
    // The 2026-09-09 regression: the Aug 27 intro class was still the first
    // and cheapest card 13 days after it ran, under a "Start here" heading,
    // so its $8 read as the price of the program. Card, CTA and JSON-LD offer
    // all have to go together — a hidden card with a live offer still tells
    // Google and every AI scheduler there is an $8 class on sale.
    await page.goto(PAGE_PATH);
    const ld = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).join("\n");
    for (const program of FINISHED) {
      await expect(page.getByTestId(`mvf-program-${program.key}`)).toHaveCount(0);
      await expect(page.getByTestId(`mvf-register-${program.key}`)).toHaveCount(0);
      expect(ld, `finished class still in JSON-LD: ${program.key}`).not.toContain(
        program.activityName,
      );
    }
  });

  test("names both bracket times so a parent can pick before they scroll", async ({
    page,
  }) => {
    // Red/Orange 5:30–6:30, Green/Yellow 6:30–7:30 lived only on the
    // individual cards, so the section intro said classes run "back to back"
    // without ever saying when either one is.
    await page.goto(PAGE_PATH);
    const body = await page.locator("body").innerText();
    for (const program of LIVE.filter((p) => p.classCount > 1)) {
      expect(body).toContain(program.timeLabel);
    }
  });

  test("every class shows its published time and its own venue", async ({ page }) => {
    await page.goto(PAGE_PATH);
    for (const program of LIVE) {
      const card = page.getByTestId(`mvf-program-${program.key}`);
      await expect(card).toContainText(program.timeLabel);
      await expect(card).toContainText(program.venue.name);
    }
    // Venues are per-program: the intro is elsewhere, both fall sessions are
    // at North Creek since MVF moved Fall I there on 2026-08-27. A regression
    // that republishes Watkins Mill to families is the exact drift this pins.
    for (const key of ["fall-1-beginner", "fall-2-beginner"]) {
      if (!LIVE.some((p) => p.key === key)) continue;
      await expect(page.getByTestId(`mvf-program-${key}`)).toContainText(
        "North Creek",
      );
    }
    if (LIVE.some((p) => p.key === "intro")) {
      await expect(page.getByTestId("mvf-program-intro")).toContainText(
        "Apple Ridge",
      );
    }
  });

  test("every class links out to its own MVF activity in a new tab", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    for (const program of LIVE) {
      const cta = page.getByTestId(`mvf-register-${program.key}`);
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", program.registerUrl);
      await expect(cta).toHaveAttribute("target", "_blank");
      await expect(cta).toHaveAttribute("rel", /noopener/);
    }
  });

  test("says registration is open and routes to MVF (no NGA checkout)", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    await expect(page.getByTestId("mvf-registration-open-badge")).toHaveCount(
      LIVE.length > 0 ? 1 : 0,
    );
    if (LIVE.length > 0) {
      await expect(page.getByTestId("mvf-registration-open-badge")).toContainText(
        /registration is open/i,
      );
    }
    const note = page.getByTestId("mvf-registration-note");
    await expect(note).toContainText(
      /register and pay on MVF['’]s site, not ours/i,
    );
    await expect(page.getByTestId("mvf-browse-all")).toHaveAttribute(
      "href",
      MVF_REGISTRATION_SEARCH_URL,
    );
    // No NGA payment surface may appear on this page.
    await expect(page.locator('a[href*="/api/checkout"]')).toHaveCount(0);
  });

  test("never promises a seat alert we have no way to send", async ({ page }) => {
    await page.goto(PAGE_PATH);
    // MVF seat counts live in MVF's portal; nothing here reads them, so any
    // copy implying we'll warn a parent that a class is filling is a promise
    // the system cannot keep.
    //
    // Widened 2026-09-04: the same failure isn't only about SEATS. A venue-move
    // blurb once said MVF "will let registered families know" — NGA has no
    // channel to send that and no way to verify MVF sent it, and it contradicts
    // mvf.ts's own instruction to tell families to confirm before heading out.
    // A parent who reads "they'll let you know" waits passively and drives to
    // the wrong court. Any second-hand promise that someone else will notify
    // belongs here, not just seat alerts.
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const claim of [
      "close to full",
      "when a class fills",
      "when a spot opens",
      "alert you when",
      "notify you when a",
      "let registered families know",
      "let you know",
      "we'll notify",
      "they'll notify",
    ]) {
      expect(body, `page must not promise: ${claim}`).not.toContain(claim);
    }
  });

  test("shows MVF's own activity title so a parent can match it in the portal", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);
    for (const program of LIVE) {
      await expect(page.getByTestId(`mvf-program-${program.key}`)).toContainText(
        program.activityName,
      );
    }
  });

  test("emits SportsEvent JSON-LD for each program", async ({ page }) => {
    await page.goto(PAGE_PATH);
    const scripts = page.locator('script[type="application/ld+json"]');
    expect(await scripts.count()).toBeGreaterThan(0);
    const bodies = await scripts.allTextContents();
    const sportsEvents = bodies.filter((b) => b.includes('"SportsEvent"'));
    expect(sportsEvents.length).toBe(LIVE.length);
    const joined = bodies.join("\n");
    for (const program of LIVE) {
      expect(joined).toContain(program.venue.name);
      for (const price of program.prices) {
        expect(joined).toContain(`"price":${price.usd}`);
      }
    }
    // Watkins Mill is the contingency venue only — it must not reach JSON-LD,
    // which is what search engines and assistants read back to families.
    expect(joined).not.toContain("Watkins Mill Pickleball Courts");
    // Registration is live — offers must not still advertise PreOrder.
    if (LIVE.length > 0) expect(joined).toContain("https://schema.org/InStock");
    expect(joined).not.toContain("https://schema.org/PreOrder");
  });

  test("embeds the newsletter form as the primary CTA", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(page.locator("#newsletter input#parentName")).toBeVisible();
    await expect(page.locator("#newsletter input#email")).toBeVisible();
  });

  test("carries no tournament cross-promo (the Sept 5 card was removed 2026-09-04)", async ({ page }) => {
    await page.goto(PAGE_PATH);
    await expect(page.getByTestId("mvf-tournament-card")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Want game day too?");
    await expect(page.locator("body")).not.toContainText("Tournament day");
  });

  test("is linked from the global Navbar (desktop direct, mobile via hamburger)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: /toggle menu/i }).click();
    }
    const navLink = page.locator("nav").getByRole("link", { name: "MVF Classes" });
    await expect(navLink.first()).toBeVisible();
    await expect(navLink.first()).toHaveAttribute("href", PAGE_PATH);
  });

  test("appears in the sitemap", async ({ page }) => {
    const resp = await page.goto("/sitemap.xml");
    expect(resp?.status()).toBe(200);
    const body = await page.content();
    expect(body).toContain(`https://nextgenpbacademy.com${PAGE_PATH}</loc>`);
  });
});
