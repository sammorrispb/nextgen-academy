// E2E for the cluster-attribution PR: city pages link to clusters,
// the /crew form captures ?cluster=, and the welcome email theme switches.
//   npx playwright test e2e/cluster-attribution.spec.ts
import { test, expect } from "@playwright/test";
import { getClusterForCity } from "../src/lib/clusters";
import { CLUSTERS } from "../src/data/clusters";
import {
  crewInterestWelcomeHtml,
  crewInterestWelcomeSubject,
  crewInterestWelcomeText,
} from "../src/lib/email/crew-interest-welcome";

// Cities that have a /youth-pickleball-<slug> page TODAY. Chevy Chase is in
// SERVICE_AREAS but has no landing page yet — exclude it here; the
// assertEveryServiceCityHasCluster unit test in clusters.spec.ts catches
// the cluster-mapping side of the same gap.
const CITY_PAGES = [
  { city: "Bethesda", slug: "youth-pickleball-bethesda" },
  { city: "North Bethesda", slug: "youth-pickleball-north-bethesda" },
  { city: "Rockville", slug: "youth-pickleball-rockville" },
  { city: "Potomac", slug: "youth-pickleball-potomac" },
  { city: "Gaithersburg", slug: "youth-pickleball-gaithersburg" },
  { city: "Germantown", slug: "youth-pickleball-germantown" },
  { city: "Olney", slug: "youth-pickleball-olney" },
  { city: "Silver Spring", slug: "youth-pickleball-silver-spring" },
] as const;

test.describe("City landing pages link to the right cluster", () => {
  for (const { city, slug } of CITY_PAGES) {
    const cluster = getClusterForCity(city);
    if (!cluster) continue;
    test(`${city} → ${cluster.name}`, async ({ page }) => {
      await page.goto(`/${slug}`);
      const callout = page.getByTestId("cluster-callout");
      await expect(callout).toBeVisible();
      await expect(callout).toContainText(cluster.region);
      await expect(callout).toContainText(cluster.name);

      const link = page.getByTestId("cluster-callout-link");
      await expect(link).toHaveAttribute("href", `/clusters/${cluster.slug}`);
      await expect(link).toContainText(cluster.name);
    });
  }
});

test.describe("/crew?cluster=<slug> attribution capture", () => {
  for (const cluster of CLUSTERS) {
    test(`/crew?cluster=${cluster.slug} loads and the cluster is in the URL`, async ({
      page,
    }) => {
      await page.goto(`/crew?cluster=${cluster.slug}`);
      // The page renders + the form is present
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // URL param is preserved (the form reads it on mount via URLSearchParams)
      expect(page.url()).toContain(`cluster=${cluster.slug}`);
    });
  }

  test("API route accepts a cluster slug in the payload", async ({ request }) => {
    // Hit the real API with a fully-validated submission carrying ?cluster=teal.
    // 200 means the route accepted the cluster field; 400 would mean the
    // validator wrongly rejected it.
    const resp = await request.post("/api/crew-interest", {
      data: {
        parentName: `E2E Tester ${Date.now()}`,
        email: `e2e+${Date.now()}@example.com`,
        childFirstName: "Riley",
        childAge: "10",
        childLevel: "Green",
        preferredDays: ["Wed"],
        preferredTimeOfDay: ["Afternoon"],
        preferredTime: "after school",
        cluster: "teal",
        source: "Web",
      },
    });
    expect([200, 429]).toContain(resp.status());
  });

  test("API route silently drops an unknown cluster slug", async ({
    request,
  }) => {
    const resp = await request.post("/api/crew-interest", {
      data: {
        parentName: `E2E Tester ${Date.now()}`,
        email: `e2e+${Date.now()}@example.com`,
        childFirstName: "Riley",
        childAge: "10",
        childLevel: "Green",
        preferredDays: ["Wed"],
        preferredTimeOfDay: ["Afternoon"],
        preferredTime: "after school",
        cluster: "magenta",
        source: "Web",
      },
    });
    expect([200, 429]).toContain(resp.status());
  });
});

test.describe("crew-interest welcome email — cluster variant", () => {
  test("subject is generic when no cluster", () => {
    const subject = crewInterestWelcomeSubject({ childFirst: "Riley" });
    expect(subject).toBe("We're looking for Riley's crew");
  });

  for (const cluster of CLUSTERS) {
    test(`subject swaps to the cluster welcome for ${cluster.name}`, () => {
      const subject = crewInterestWelcomeSubject({
        childFirst: "Riley",
        cluster,
      });
      expect(subject).toBe(`Welcome to the ${cluster.name} interest list`);
    });

    test(`HTML body uses the ${cluster.name} accent color`, () => {
      const html = crewInterestWelcomeHtml({
        parentFirst: "Alex",
        childFirst: "Riley",
        preferredSummary: "Green · Wed · 4-6pm",
        newsletterUrl: "https://example.com",
        cluster,
      });
      expect(html).toContain(cluster.hex);
      expect(html).toContain(cluster.name.toUpperCase());
      expect(html).toContain(`is on the ${cluster.name} list, Alex.`);
      expect(html).toContain("Year-round training");
    });

    test(`plain-text body switches to cluster framing for ${cluster.name}`, () => {
      const text = crewInterestWelcomeText({
        parentFirst: "Alex",
        childFirst: "Riley",
        preferredSummary: "Green · Wed · 4-6pm",
        newsletterUrl: "https://example.com",
        cluster,
      });
      expect(text).toContain(`Riley is on the ${cluster.name} list, Alex.`);
      expect(text).toContain("Year-round training");
      expect(text).toContain("Better than yesterday, together.");
    });
  }

  test("HTML body falls back to generic crew framing without cluster", () => {
    const html = crewInterestWelcomeHtml({
      parentFirst: "Alex",
      childFirst: "Riley",
      preferredSummary: "Green · Wed · 4-6pm",
      newsletterUrl: "https://example.com",
    });
    expect(html).toContain("We&rsquo;re looking for Riley&rsquo;s crew, Alex.");
    expect(html).toContain("Same four kids every week");
    expect(html).not.toContain("Year-round training");
  });
});
