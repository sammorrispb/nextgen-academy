import { test, expect } from "@playwright/test";
import {
  canonicalizeUrl,
  dedupeAndSort,
  matchYouthPickleball,
  type RawNewsItem,
} from "../src/lib/news-scraper";

test.describe("canonicalizeUrl", () => {
  test("strips utm + tracking params but keeps real query keys", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/article?id=123&utm_source=google&utm_campaign=x&gclid=abc",
      ),
    ).toBe("https://example.com/article?id=123");
  });

  test("lowercases host, drops trailing slash, drops fragment", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/Path/#section")).toBe(
      "https://example.com/Path",
    );
  });

  test("unwraps Google News redirector when ?url= is present", () => {
    expect(
      canonicalizeUrl(
        "https://news.google.com/articles/abc?url=https%3A%2F%2Fexample.com%2Freal&hl=en",
      ),
    ).toBe("https://example.com/real");
  });

  test("garbage input returns the trimmed string instead of throwing", () => {
    expect(canonicalizeUrl("  not-a-url  ")).toBe("not-a-url");
    expect(canonicalizeUrl("")).toBe("");
  });
});

test.describe("matchYouthPickleball", () => {
  test("requires both a pickleball term and a youth term", () => {
    expect(matchYouthPickleball("PPA tour final recap", "Pro pickleball coverage")).toEqual([]);
    expect(matchYouthPickleball("Local kids soccer roundup", "no pickle here")).toEqual([]);
  });

  test("matches when both signals are present in title or summary", () => {
    const hits = matchYouthPickleball(
      "Youth pickleball academy opens in Bethesda",
      "",
    );
    expect(hits[0]).toBe("pickleball");
    expect(hits).toContain("youth");
    expect(hits).toContain("academy");
  });

  test("is case-insensitive and works across title + summary", () => {
    const hits = matchYouthPickleball(
      "New PICKLEBALL Camp",
      "Open to KIDS and teens this summer",
    );
    expect(hits).toContain("pickleball");
    expect(hits).toContain("kid");
    expect(hits).toContain("teen");
    expect(hits).toContain("camp");
  });

  test("accepts the spaced variant 'pickle ball'", () => {
    const hits = matchYouthPickleball(
      "High school pickle ball league forms",
      "",
    );
    expect(hits).toContain("pickle ball");
    expect(hits).toContain("high school");
  });
});

test.describe("dedupeAndSort", () => {
  function mk(url: string, published: string, title = "t"): RawNewsItem {
    return {
      title,
      url,
      source: "s",
      summary: "",
      published,
      keywordHits: [],
    };
  }

  test("first URL wins on duplicate", () => {
    const out = dedupeAndSort([
      mk("https://a.com/x", "2026-05-20T00:00:00Z", "first"),
      mk("https://a.com/x", "2026-05-21T00:00:00Z", "second"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("first");
  });

  test("sorts newest-published first; missing dates go to the back", () => {
    const out = dedupeAndSort([
      mk("https://a.com/old", "2026-04-01T00:00:00Z", "old"),
      mk("https://a.com/new", "2026-05-20T00:00:00Z", "new"),
      mk("https://a.com/undated", "", "undated"),
    ]);
    expect(out.map((i) => i.title)).toEqual(["new", "old", "undated"]);
  });

  test("drops items with empty URL", () => {
    const out = dedupeAndSort([mk("", "2026-05-20T00:00:00Z")]);
    expect(out).toEqual([]);
  });
});
