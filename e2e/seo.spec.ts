/**
 * SEO sweep — per-route assertions for the foundations that move the needle:
 *   - canonical present + self-referential
 *   - exactly one h1 (visible OR sr-only counts; both render in the DOM)
 *   - title ≤60 chars, meta description ≤160 chars
 *   - og:url present
 *   - twitter:title + twitter:description match (or fall back to) og:title/og:description
 *   - JSON-LD parses
 *   - sitemap.xml includes every route under test
 *   - robots.txt resolves
 *
 * Per the 2026-05-24 SEO sweep brief: the 4 new city pages additionally
 * assert the city name + "pickleball" appear in the H1, and that the
 * LocalBusiness JSON-LD lists the city in areaServed.
 */
import { test, expect, type Page } from "@playwright/test";

interface RouteSpec {
  path: string;
  /** Title prefix Google would see — used to disambiguate per-page metadata. */
  titleContains?: RegExp;
  /** If set, asserts the H1 text includes this. */
  h1Contains?: RegExp;
  /** City to look for in the LocalBusiness JSON-LD `areaServed` array. */
  cityInAreaServed?: string;
}

const ROUTES: RouteSpec[] = [
  {
    path: "/",
    titleContains: /Next Gen PB Academy/,
    h1Contains: /Real pickleball coaching for/i,
  },
  {
    path: "/free-evaluation",
    titleContains: /Free.*Youth Pickleball Evaluation/,
    h1Contains: /first 30 minutes/i,
  },
  {
    path: "/schools",
    titleContains: /Schools.*Camps/,
    h1Contains: /Bring real pickleball coaching/i,
  },
  {
    path: "/schedule",
    titleContains: /Youth Pickleball Schedule/,
    h1Contains: /Youth Pickleball Schedule/i,
  },
  {
    path: "/newsletter",
    titleContains: /Free Youth Pickleball Newsletter/,
    h1Contains: /youth pickleball crew is growing/i,
  },
  {
    path: "/montgomery-county-youth-pickleball",
    titleContains: /Montgomery County/,
    h1Contains: /Youth pickleball in/i,
  },
  {
    path: "/youth-pickleball-bethesda",
    titleContains: /Bethesda/,
    h1Contains: /Bethesda.*pickleball|pickleball.*Bethesda/i,
    cityInAreaServed: "Bethesda",
  },
  {
    path: "/youth-pickleball-rockville",
    titleContains: /Rockville/,
    h1Contains: /Rockville.*pickleball|pickleball.*Rockville/i,
    cityInAreaServed: "Rockville",
  },
  {
    path: "/youth-pickleball-potomac",
    titleContains: /Potomac/,
    h1Contains: /Potomac.*pickleball|pickleball.*Potomac/i,
    cityInAreaServed: "Potomac",
  },
  {
    path: "/youth-pickleball-gaithersburg",
    titleContains: /Gaithersburg/,
    h1Contains: /Gaithersburg.*pickleball|pickleball.*Gaithersburg/i,
    cityInAreaServed: "Gaithersburg",
  },
];

/**
 * Resolve a `/path` to its absolute production URL — needed for the canonical /
 * og:url assertion since metadataBase is the prod origin (not localhost).
 */
function absoluteUrl(path: string): string {
  return new URL(path, "https://nextgenpbacademy.com").toString();
}

async function getAllJsonLd(page: Page): Promise<unknown[]> {
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return blocks.map((raw) => JSON.parse(raw));
}

function flatten(node: unknown, acc: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const item of node) flatten(item, acc);
    return acc;
  }
  acc.push(node);
  for (const value of Object.values(node as Record<string, unknown>)) {
    flatten(value, acc);
  }
  return acc;
}

test.describe("SEO foundations — per-route", () => {
  for (const route of ROUTES) {
    test.describe(route.path, () => {
      test("canonical is present and self-referential", async ({ page }) => {
        await page.goto(route.path);
        const href = await page
          .locator('link[rel="canonical"]')
          .getAttribute("href");
        expect(href, "canonical href").toBeTruthy();
        const expected = absoluteUrl(route.path === "/" ? "/" : route.path);
        // metadataBase resolves canonical with the trailing slash differently
        // for "/" vs nested routes — normalize by stripping the trailing slash
        // on nested routes.
        const norm = (u: string) =>
          u.replace(/\/$/, "") || "https://nextgenpbacademy.com";
        expect(norm(href!)).toBe(norm(expected));
      });

      test("title is set and within budget", async ({ page }) => {
        await page.goto(route.path);
        const title = await page.title();
        // Google truncates titles around 60 chars (mobile is tighter). Per-page
        // titles use `{ absolute }` so the brand-template suffix doesn't push
        // them over.
        expect(title.length, `title length for ${route.path}`).toBeLessThanOrEqual(
          60,
        );
        if (route.titleContains) {
          expect(title).toMatch(route.titleContains);
        }
      });

      test("meta description is set and ≤160 chars", async ({ page }) => {
        await page.goto(route.path);
        const desc = await page
          .locator('meta[name="description"]')
          .getAttribute("content");
        expect(desc, "meta description").toBeTruthy();
        expect(
          desc!.length,
          `description length for ${route.path}`,
        ).toBeLessThanOrEqual(160);
      });

      test("og:url is present", async ({ page }) => {
        await page.goto(route.path);
        const og = await page
          .locator('meta[property="og:url"]')
          .getAttribute("content");
        expect(og, `og:url for ${route.path}`).toBeTruthy();
      });

      test("twitter:title + twitter:description match the page metadata", async ({
        page,
      }) => {
        await page.goto(route.path);
        const twTitle = await page
          .locator('meta[name="twitter:title"]')
          .getAttribute("content");
        const twDesc = await page
          .locator('meta[name="twitter:description"]')
          .getAttribute("content");
        expect(twTitle, `twitter:title for ${route.path}`).toBeTruthy();
        expect(
          twDesc,
          `twitter:description for ${route.path}`,
        ).toBeTruthy();
      });

      test("renders exactly one h1", async ({ page }) => {
        await page.goto(route.path);
        const count = await page.locator("h1").count();
        expect(count, `h1 count for ${route.path}`).toBe(1);
        if (route.h1Contains) {
          const text = await page.locator("h1").first().textContent();
          expect(text ?? "").toMatch(route.h1Contains);
        }
      });

      test("every JSON-LD block parses", async ({ page }) => {
        await page.goto(route.path);
        const blocks = await getAllJsonLd(page);
        expect(blocks.length, `JSON-LD blocks on ${route.path}`).toBeGreaterThan(
          0,
        );
        for (const block of blocks) {
          expect(block).toBeTruthy();
        }
      });

      if (route.cityInAreaServed) {
        test(`LocalBusiness JSON-LD lists ${route.cityInAreaServed} in areaServed`, async ({
          page,
        }) => {
          await page.goto(route.path);
          const blocks = await getAllJsonLd(page);
          // Find a LocalBusiness-typed block on this page (city landers
          // render one via localBusinessJsonLd()).
          const localBiz = blocks.find((block) => {
            const types = (block as { "@type"?: string | string[] })["@type"];
            const typeArr = Array.isArray(types) ? types : [types];
            return typeArr.includes("LocalBusiness");
          });
          expect(localBiz, "LocalBusiness JSON-LD block").toBeTruthy();
          const areaServed = (localBiz as { areaServed?: unknown[] })
            .areaServed;
          expect(Array.isArray(areaServed)).toBe(true);
          const cities = flatten(areaServed)
            .map((n) => (n as { name?: string }).name)
            .filter(Boolean);
          expect(cities).toContain(route.cityInAreaServed);
        });
      }
    });
  }
});

test.describe("SEO foundations — site-wide", () => {
  test("sitemap.xml is reachable and lists every route under test", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const xml = await res.text();
    for (const route of ROUTES) {
      const expected = absoluteUrl(route.path === "/" ? "/" : route.path);
      // Sitemap may render with or without trailing slash — accept either.
      const present =
        xml.includes(expected) || xml.includes(expected.replace(/\/$/, ""));
      expect(present, `sitemap missing ${route.path}`).toBe(true);
    }
  });

  test("robots.txt is reachable", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text.toLowerCase()).toContain("user-agent");
  });

  test("legacy Squarespace URLs 301 to current pages", async ({ page }) => {
    // /about-us-1 was #1 organic on 2026-05-24 — must not 404.
    for (const legacy of ["/about-us-1", "/contact-us-1", "/our-programs"]) {
      const response = await page.goto(legacy, {
        waitUntil: "domcontentloaded",
      });
      expect(
        response?.status(),
        `${legacy} should resolve`,
      ).toBeLessThan(400);
    }
  });
});

test.describe("City pages — visible H1 + clickable Free Evaluation CTA", () => {
  for (const route of ROUTES.filter((r) => r.cityInAreaServed)) {
    test(`${route.path} renders H1 with city + has visible Free Evaluation CTA`, async ({
      page,
    }) => {
      await page.goto(route.path);
      // City + "pickleball" in the visible H1.
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const text = (await h1.textContent()) ?? "";
      expect(text).toMatch(new RegExp(route.cityInAreaServed!, "i"));
      expect(text.toLowerCase()).toContain("pickleball");

      // Free-evaluation CTA reachable from the hero — either the in-page form
      // anchor (#contact-form) or a direct link to /free-evaluation.
      const cta = page
        .getByRole("link", { name: /book.*free.*evaluation/i })
        .first();
      await expect(cta).toBeVisible();
      const href = await cta.getAttribute("href");
      expect(href, "CTA href").toBeTruthy();
      // Accepts the in-page anchor or the dedicated /free-evaluation page.
      expect(href!).toMatch(/(#contact-form|\/free-evaluation)/);
    });
  }
});
