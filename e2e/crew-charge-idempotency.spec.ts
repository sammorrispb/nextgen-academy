import { test, expect } from "@playwright/test";
import { crewChargeIdempotencyKey } from "../src/lib/crew-charge";

// crew-autoreserve charges a saved card off-session ($20) once per (commit,
// session). The only pre-existing guard was an eventually-consistent Notion
// roster lookup — a same-day cron re-run (Vercel retry / overlapping invocation)
// could race past it and double-charge. A deterministic Stripe idempotency key
// per (commit, session) makes a duplicate create() a no-op at the payment layer.
test.describe("crewChargeIdempotencyKey", () => {
  test("is deterministic for the same commit + session", () => {
    expect(crewChargeIdempotencyKey("c1", "s1")).toBe(
      crewChargeIdempotencyKey("c1", "s1"),
    );
  });

  test("differs when the session differs (next week is a new, separate charge)", () => {
    expect(crewChargeIdempotencyKey("c1", "s1")).not.toBe(
      crewChargeIdempotencyKey("c1", "s2"),
    );
  });

  test("differs when the commit differs (two parents, same session)", () => {
    expect(crewChargeIdempotencyKey("c1", "s1")).not.toBe(
      crewChargeIdempotencyKey("c2", "s1"),
    );
  });

  test("embeds both ids and is non-empty so a same-day re-run dedupes at Stripe", () => {
    const k = crewChargeIdempotencyKey("commit-abc", "sess-xyz");
    expect(k).toContain("commit-abc");
    expect(k).toContain("sess-xyz");
    expect(k.length).toBeGreaterThan(0);
  });
});
