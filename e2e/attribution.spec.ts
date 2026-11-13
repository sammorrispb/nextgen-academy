import { test, expect } from "@playwright/test";
import { attributedSource } from "../src/lib/attribution";

test.describe("attributedSource", () => {
  test("maps facebook/fb to Facebook Ad", () => {
    expect(attributedSource({ utm_source: "facebook" })).toBe("Facebook Ad");
    expect(attributedSource({ utm_source: "FB" })).toBe("Facebook Ad");
  });

  test("maps instagram/ig to Instagram Ad", () => {
    expect(attributedSource({ utm_source: "Instagram" })).toBe("Instagram Ad");
    expect(attributedSource({ utm_source: "ig" })).toBe("Instagram Ad");
  });

  test("maps google to Google Ad", () => {
    expect(attributedSource({ utm_source: "google" })).toBe("Google Ad");
  });

  test("unknown utm_source becomes Ad: <source>", () => {
    expect(attributedSource({ utm_source: "nextdoor" })).toBe("Ad: nextdoor");
  });

  test("an arrival from one of Sam's other sites is a Family site, not an ad", () => {
    // What the sibling sites' switchers stamp on a link to this site.
    expect(attributedSource({ utm_source: "linkanddink", utm_medium: "cross_family_nav" })).toBe("Family site");
    expect(attributedSource({ utm_source: "sammorrispb", utm_medium: "cross_family_nav", utm_content: "switcher_nga" })).toBe("Family site");
    // The medium alone decides it; a missing source must not fall to the fallback.
    expect(attributedSource({ utm_medium: "cross_family_nav" })).toBe("Family site");
    expect(attributedSource({ utm_medium: "cross_family_nav" }, "Website Lead Form")).toBe("Family site");
  });

  test("the family medium leaves every other mapping where it was", () => {
    // Named ad platforms still win, whatever the medium says.
    expect(attributedSource({ utm_source: "facebook", utm_medium: "cross_family_nav" })).toBe("Facebook Ad");
    expect(attributedSource({ utm_source: "ig", utm_medium: "cross_family_nav" })).toBe("Instagram Ad");
    expect(attributedSource({ utm_source: "google", utm_medium: "cross_family_nav" })).toBe("Google Ad");
    // Without that medium an unknown source is still an ad, and no utm is still the fallback.
    expect(attributedSource({ utm_source: "linkanddink" })).toBe("Ad: linkanddink");
    expect(attributedSource({ utm_source: "linkanddink", utm_medium: "email" })).toBe("Ad: linkanddink");
    expect(attributedSource({ utm_source: "facebook", utm_medium: "cpc" })).toBe("Facebook Ad");
    expect(attributedSource({ utm_medium: "email" })).toBe("Website");
    expect(attributedSource({ utm_medium: null, utm_source: null })).toBe("Website");
  });

  test("every route that writes a Source select uses the shared vocabulary", async () => {
    const { readFileSync } = await import("node:fs");
    const routes: Record<string, string> = {
      "src/app/api/lead/route.ts": 'attributedSource(body, "Website Lead Form")',
      "src/app/api/contact/route.ts": 'attributedSource(body, "Website Contact Form")',
      "src/app/api/schools-lead/route.ts": 'attributedSource(body, "Schools Inquiry Form")',
      "src/app/api/waitlist/route.ts": "attributedSource(body)",
      "src/app/api/stripe/webhook/route.ts": 'utm_medium: metaString(m, "source_utm_medium")',
    };
    for (const [file, call] of Object.entries(routes)) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain('import { attributedSource } from "@/lib/attribution"');
      expect(source, file).toContain(call);
      // A private copy of the mapping is how two routes missed this branch.
      expect(source, file).not.toMatch(/function attributedSource|`Ad: /);
    }
  });

  test("absent utm_source falls back to default Website", () => {
    expect(attributedSource({})).toBe("Website");
    expect(attributedSource({ utm_source: "" })).toBe("Website");
    expect(attributedSource({ utm_source: undefined })).toBe("Website");
  });

  test("caller-supplied fallback is honored (lead-form vocab preserved)", () => {
    expect(attributedSource({}, "Website Lead Form")).toBe("Website Lead Form");
    expect(attributedSource({ utm_source: "google" }, "Website Lead Form")).toBe(
      "Google Ad",
    );
  });

  test("tolerates null-ish fields (pre-deploy Stripe sessions, Payment Links)", () => {
    expect(
      attributedSource({ utm_source: null as unknown as undefined }),
    ).toBe("Website");
  });

  test("garbage utm_source can't 400 the Notion select (100-char cap, no commas)", () => {
    const long = attributedSource({ utm_source: "x".repeat(600) });
    expect(long.length).toBeLessThanOrEqual(100);
    expect(long.startsWith("Ad: x")).toBe(true);
    expect(attributedSource({ utm_source: "a,b" })).toBe("Ad: a b");
  });
});
