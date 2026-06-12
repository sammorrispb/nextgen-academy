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
