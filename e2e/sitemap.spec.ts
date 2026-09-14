import { test, expect } from "@playwright/test";
import sitemap from "../src/app/sitemap";
import { blogPosts } from "../src/data/blog";

/**
 * Sitemap content + honest lastModified (AEO audit, 2026-09-13).
 *
 * It used to stamp `new Date()` on every URL at every build, so every page
 * claimed to have changed today — a signal search engines learn to ignore.
 * Now only entries with a real content date carry one (blog posts use
 * datePublished); everything else omits the field rather than guess.
 */

const BASE = "https://nextgenpbacademy.com";

test.describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  test("lists the pages answer engines should find", () => {
    for (const path of [
      "/league",
      "/picklpark",
      "/levels",
      "/youth-pickleball-frederick",
      "/montgomery-county-youth-pickleball",
    ]) {
      expect(urls, path).toContain(`${BASE}${path}`);
    }
    for (const post of blogPosts) {
      expect(urls, post.slug).toContain(`${BASE}/blog/${post.slug}`);
    }
  });

  test("blog entries carry their publish date; nothing else claims a date", () => {
    for (const e of entries) {
      const post = blogPosts.find((p) => e.url === `${BASE}/blog/${p.slug}`);
      if (post) {
        expect(e.lastModified, e.url).toBe(post.datePublished);
      } else {
        expect(e.lastModified, e.url).toBeUndefined();
      }
    }
  });

  test("URLs are unique and no signed-link surface leaks in", () => {
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) expect(u).not.toContain("standings");
  });
});
