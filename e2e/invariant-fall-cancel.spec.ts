import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { FetchStub } from "./fixtures/fetch-stub";

// Env BEFORE importing the module under test (libs read these at call time).
process.env.NOTION_API_KEY = "ntn_test";
process.env.NOTION_FALL_REGS_DB_ID = "fall-regs-db";
process.env.RESEND_API_KEY = "re_test";

import { cancelFallByPaymentIntent } from "../src/lib/cancel-fall";

// Fall season registrations keep their own Notion roster, and a row with
// Status = "Confirmed" is what occupies one of the 8 seats per group (the
// capacity guard in /api/checkout-fall counts exactly that). Before this
// existed, an out-of-band refund (Stripe Dashboard, MCP, admin API) left the
// row stuck on Confirmed — seat unsellable, parent un-emailed. That is the
// SAME failure the drop-in path was rewritten to close; these pin that fall
// can't regress into it.

const PI = "pi_fall_probe";

function fallRow(status: "Confirmed" | "Refunded" | "Cancelled" = "Confirmed") {
  return {
    id: "fall-row-1",
    properties: {
      "Parent Name": { title: [{ plain_text: "Parent One" }] },
      "Parent Email": { email: "parent@example.com" },
      "Child First Name": { rich_text: [{ plain_text: "Kid" }] },
      Group: { select: { name: "Green" } },
      Status: { select: { name: status } },
      "Amount Paid": { number: 225 },
      "Stripe Checkout Session ID": { rich_text: [{ plain_text: "cs_fall_probe" }] },
    },
  };
}

test("a refunded fall registration flips the roster row, which frees the seat", async () => {
  const stub = new FetchStub()
    .on("/databases/fall-regs-db/query", { results: [fallRow("Confirmed")] })
    .on("/pages/fall-row-1", { id: "fall-row-1" })
    .on("api.resend.com", { id: "email_1" })
    .install();

  try {
    const result = await cancelFallByPaymentIntent(PI);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("Refunded");

    // The seat is freed by the Status flip itself — the capacity guard counts
    // Confirmed rows, so there is no separate decrement to assert.
    const patch = stub.calls.find(
      (c) => c.method === "PATCH" && c.url.includes("/pages/fall-row-1"),
    );
    expect(patch, "roster row must be PATCHed").toBeTruthy();
    expect(patch!.body).toContain("Refunded");
  } finally {
    stub.uninstall();
  }
});

test("the parent gets a cancellation email, not silence", async () => {
  const stub = new FetchStub()
    .on("/databases/fall-regs-db/query", { results: [fallRow("Confirmed")] })
    .on("/pages/fall-row-1", { id: "fall-row-1" })
    .on("api.resend.com", { id: "email_1" })
    .install();

  try {
    const result = await cancelFallByPaymentIntent(PI);
    expect(result.ok && result.emailSent).toBe(true);

    const send = stub.calls.find((c) => c.url.includes("api.resend.com"));
    expect(send, "a cancellation email must be sent").toBeTruthy();
    expect(send!.body).toContain("parent@example.com");
    // Admin always gets a BCC copy, never a CC (other parents' addresses).
    expect(send!.body).toContain("nextgenacademypb@gmail.com");
    expect(send!.body.toLowerCase()).not.toContain('"cc"');
  } finally {
    stub.uninstall();
  }
});

test("webhook redelivery is idempotent — no second flip, no second email", async () => {
  const stub = new FetchStub()
    .on("/databases/fall-regs-db/query", { results: [fallRow("Refunded")] })
    .on("/pages/fall-row-1", { id: "fall-row-1" })
    .on("api.resend.com", { id: "email_1" })
    .install();

  try {
    const result = await cancelFallByPaymentIntent(PI);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.idempotent).toBe(true);

    expect(stub.calls.some((c) => c.method === "PATCH")).toBe(false);
    expect(stub.calls.some((c) => c.url.includes("api.resend.com"))).toBe(false);
  } finally {
    stub.uninstall();
  }
});

test("an unknown Payment Intent is reported, never silently swallowed", async () => {
  const stub = new FetchStub()
    .on("/databases/fall-regs-db/query", { results: [] })
    .install();

  try {
    const result = await cancelFallByPaymentIntent("pi_does_not_exist");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
  } finally {
    stub.uninstall();
  }
});

// Structural pin on the Slop-Free Zone edit: the fall branch must sit BEHIND
// the drop-in lookup and fire only when that lookup misses, so no drop-in
// refund can be re-routed into the fall roster.
test("webhook tries drop-in first and only falls through on not_found", () => {
  const src = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");

  const dropIn = src.indexOf("cancelDropInByPaymentIntent(piId");
  const guard = src.indexOf('result.reason === "not_found"');
  const fall = src.indexOf("cancelFallByPaymentIntent(piId)");

  expect(dropIn, "drop-in lookup must exist").toBeGreaterThan(-1);
  expect(guard, "fall path must be guarded on not_found").toBeGreaterThan(-1);
  expect(fall, "fall fallthrough must exist").toBeGreaterThan(-1);

  expect(dropIn).toBeLessThan(guard);
  expect(guard).toBeLessThan(fall);
});
