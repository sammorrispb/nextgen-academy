import { test, expect } from "@playwright/test";
import { classifyNotionFailure } from "../src/lib/notion-dropins";

test.describe("classifyNotionFailure", () => {
  test("429 rate-limit is transient (worth a Stripe retry)", () => {
    expect(classifyNotionFailure(429)).toBe("transient");
  });

  test("5xx server errors are transient", () => {
    expect(classifyNotionFailure(500)).toBe("transient");
    expect(classifyNotionFailure(502)).toBe("transient");
    expect(classifyNotionFailure(503)).toBe("transient");
  });

  test("other 4xx are permanent (retry would fail identically)", () => {
    expect(classifyNotionFailure(400)).toBe("permanent");
    expect(classifyNotionFailure(401)).toBe("permanent");
    expect(classifyNotionFailure(404)).toBe("permanent");
    expect(classifyNotionFailure(422)).toBe("permanent");
  });
});
