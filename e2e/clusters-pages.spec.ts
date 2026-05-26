// Browser e2e for /clusters + /clusters/[color]. Requires `npm run dev` running.
//   npx playwright test e2e/clusters-pages.spec.ts
import { test, expect } from "@playwright/test";
import { CLUSTERS } from "../src/data/clusters";
import { CLUSTER_FAQ } from "../src/data/cluster-faq";

test.describe("/clusters index", () => {
  test("shows the Coming Fall 2026 banner", async ({ page }) => {
    await page.goto("/clusters");
    const banner = page.getByTestId("coming-soon-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Coming Fall 2026/i);
  });

  test("renders all 4 cluster cards", async ({ page }) => {
    await page.goto("/clusters");
    for (const c of CLUSTERS) {
      const card = page.getByTestId(`cluster-card-${c.slug}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(c.name);
      await expect(card).toHaveAttribute("href", `/clusters/${c.slug}`);
    }
  });

  test("each cluster card surfaces its region label + neighborhoods", async ({ page }) => {
    await page.goto("/clusters");
    for (const c of CLUSTERS) {
      const card = page.getByTestId(`cluster-card-${c.slug}`);
      await expect(card).toContainText(c.region);
      // First neighborhood is the strongest signal — Bethesda for teal, etc.
      await expect(card).toContainText(c.neighborhoods[0]);
    }
  });

  test("includes the 'what clusters are not' MCPS-positioning paragraph", async ({ page }) => {
    await page.goto("/clusters");
    await expect(
      page.getByRole("heading", { name: /what clusters are not/i }),
    ).toBeVisible();
    await expect(page.getByText(/MCPS varsity/i).first()).toBeVisible();
  });

  test("emits noindex,nofollow while pre-launch", async ({ page }) => {
    await page.goto("/clusters");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots?.toLowerCase()).toContain("noindex");
    expect(robots?.toLowerCase()).toContain("nofollow");
  });
});

test.describe("/clusters/[color] sub-pages", () => {
  for (const cluster of CLUSTERS) {
    test(`${cluster.slug}: renders core elements`, async ({ page }) => {
      await page.goto(`/clusters/${cluster.slug}`);

      await expect(
        page.getByRole("heading", { level: 1, name: cluster.name }),
      ).toBeVisible();
      await expect(page.getByTestId("region-chip")).toContainText(cluster.region);
      await expect(page.getByTestId("coming-soon-pill")).toContainText(
        /Coming Fall 2026/i,
      );
      await expect(page.getByTestId("neighborhoods")).toContainText(
        cluster.neighborhoods[0],
      );
    });

    test(`${cluster.slug}: CTA routes to /crew with the cluster query param`, async ({
      page,
    }) => {
      await page.goto(`/clusters/${cluster.slug}`);
      const cta = page.getByTestId("waitlist-cta");
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", `/crew?cluster=${cluster.slug}`);
    });

    test(`${cluster.slug}: shows the /free-evaluation fallback for not-yet-group-ready families`, async ({
      page,
    }) => {
      await page.goto(`/clusters/${cluster.slug}`);
      const fallback = page.getByTestId("eval-fallback");
      await expect(fallback).toBeVisible();
      const evalLink = fallback.getByRole("link", { name: /free evaluation/i });
      await expect(evalLink).toHaveAttribute("href", "/free-evaluation");
    });

    test(`${cluster.slug}: CTA meets 48×48 min tap target (mobile WCAG 2.5.5)`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile",
        "min tap target only enforced on mobile project",
      );
      await page.goto(`/clusters/${cluster.slug}`);
      const cta = page.getByTestId("waitlist-cta");
      const box = await cta.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    });

    test(`${cluster.slug}: FAQ renders all items`, async ({ page }) => {
      await page.goto(`/clusters/${cluster.slug}`);
      const faq = page.getByTestId("cluster-faq");
      await expect(faq).toBeVisible();
      for (const item of CLUSTER_FAQ) {
        await expect(faq).toContainText(item.question);
      }
    });

    test(`${cluster.slug}: emits FAQPage JSON-LD`, async ({ page }) => {
      await page.goto(`/clusters/${cluster.slug}`);
      const scripts = page.locator('script[type="application/ld+json"]');
      const count = await scripts.count();
      let foundFaq = false;
      for (let i = 0; i < count; i++) {
        const raw = await scripts.nth(i).textContent();
        if (raw && raw.includes('"FAQPage"')) {
          foundFaq = true;
          const parsed = JSON.parse(raw);
          expect(parsed["@type"]).toBe("FAQPage");
          expect(Array.isArray(parsed.mainEntity)).toBe(true);
          expect(parsed.mainEntity.length).toBe(CLUSTER_FAQ.length);
          break;
        }
      }
      expect(foundFaq).toBe(true);
    });

    test(`${cluster.slug}: emits BreadcrumbList JSON-LD ending at the cluster`, async ({
      page,
    }) => {
      await page.goto(`/clusters/${cluster.slug}`);
      const scripts = page.locator('script[type="application/ld+json"]');
      const count = await scripts.count();
      let foundBreadcrumb = false;
      for (let i = 0; i < count; i++) {
        const raw = await scripts.nth(i).textContent();
        if (raw && raw.includes('"BreadcrumbList"')) {
          const parsed = JSON.parse(raw);
          if (parsed["@type"] !== "BreadcrumbList") continue;
          const names = parsed.itemListElement.map(
            (e: { name: string }) => e.name,
          );
          if (names[names.length - 1] === cluster.name) {
            foundBreadcrumb = true;
            break;
          }
        }
      }
      expect(foundBreadcrumb).toBe(true);
    });

    test(`${cluster.slug}: emits noindex,nofollow while pre-launch`, async ({
      page,
    }) => {
      await page.goto(`/clusters/${cluster.slug}`);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots?.toLowerCase()).toContain("noindex");
    });
  }

  test("renders against the dark navy ground (lime cluster on navy)", async ({
    page,
  }) => {
    await page.goto("/clusters/lime");
    const main = page.getByTestId("cluster-main");
    const bg = await main.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // bg-ngpa-navy = #1A2744 = rgb(26, 39, 68)
    expect(bg).toBe("rgb(26, 39, 68)");
  });

  test("unknown cluster slug returns 404", async ({ page }) => {
    const resp = await page.goto("/clusters/magenta");
    expect(resp?.status()).toBe(404);
  });
});
