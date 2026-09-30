import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FetchStub } from "./fixtures/fetch-stub";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy_offline";

import { getStripe } from "../src/lib/stripe";
import { POST as checkoutLesson } from "../src/app/api/checkout-lesson/route";
import {
  GROUP_LESSON_MAX_PLAYERS,
  GROUP_LESSON_MIN_PLAYERS,
  GROUP_LESSON_PRICE_PER_PLAYER_USD,
  LESSON_PRODUCTS,
  PRIVATE_LESSON_PRICE_USD,
  lessonTotalUsd,
} from "../src/data/lessons";
import { faq } from "../src/data/faq";
import LessonsPage from "../src/app/lessons/page";
import IntentChooser from "../src/components/IntentChooser";

// Lesson pricing, Sam 2026-09-29: a private hour is $75; a group lesson is $40
// PER PLAYER for the hour. It replaced the 2026-09-21 flat $60 hour, which a
// group split between its players. The page, the FAQ, the home-page card and
// the legacy invoice route all read src/data/lessons.ts, so what a parent is
// told and what the invoice charges move together.

const LESSON_SOURCES = [
  "data/lessons.ts",
  "data/faq.ts",
  "app/lessons/page.tsx",
  "components/IntentChooser.tsx",
  "app/api/checkout-lesson/route.ts",
];

/** Concatenated text of a React element tree, as a reader would see it. */
function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

test.describe("the price of a lesson", () => {
  test("the terms Sam set", () => {
    expect(PRIVATE_LESSON_PRICE_USD).toBe(75);
    expect(GROUP_LESSON_PRICE_PER_PLAYER_USD).toBe(40);
  });

  test("a private lesson is $75 for the hour", () => {
    expect(lessonTotalUsd("private")).toBe(75);
  });

  test("a group lesson is $40 for each player", () => {
    expect(lessonTotalUsd("group", 2)).toBe(80);
    expect(lessonTotalUsd("group", 4)).toBe(160);
    expect(lessonTotalUsd("group", 8)).toBe(320);
  });

  test("a group size outside the form's range has no price", () => {
    for (const n of [0, 1, GROUP_LESSON_MAX_PLAYERS + 1, 2.5, Number.NaN]) {
      expect(() => lessonTotalUsd("group", n), String(n)).toThrow(RangeError);
    }
    expect(() => lessonTotalUsd("group")).toThrow(RangeError);
    expect(GROUP_LESSON_MIN_PLAYERS).toBe(2);
  });
});

test.describe("what the legacy invoice route charges", () => {
  const stub = new FetchStub();
  let items: Array<{ amount?: number; quantity?: number; description?: string }>;
  let restore: Array<() => void>;

  function patch<T extends object>(target: T, key: string, fn: unknown) {
    const obj = target as Record<string, unknown>;
    const had = Object.prototype.hasOwnProperty.call(obj, key);
    const prev = obj[key];
    obj[key] = fn;
    restore.push(() => {
      if (had) obj[key] = prev;
      else delete obj[key];
    });
  }

  test.beforeEach(() => {
    // Waiver gate fails open without its DB; the admin notice goes through
    // Resend, which rides fetch and is stubbed so its amount can be read.
    delete process.env.NOTION_WAIVERS_DB_ID;
    process.env.RESEND_API_KEY = "re_test_lesson_pricing";
    stub.reset();
    stub.on("api.resend.com", { id: "email_test" });
    stub.install();

    items = [];
    restore = [];
    const stripe = getStripe();
    patch(stripe.customers, "list", async () => ({ data: [{ id: "cus_test" }] }));
    patch(stripe.invoices, "create", async () => ({ id: "in_test" }));
    patch(stripe.invoiceItems, "create", async (params: (typeof items)[number]) => {
      items.push(params);
      return { id: "ii_test" };
    });
    patch(stripe.invoices, "finalizeInvoice", async (id: string) => ({ id }));
    patch(stripe.invoices, "sendInvoice", async (id: string) => ({ id }));
    patch(stripe.invoices, "retrieve", async (id: string) => ({
      id,
      hosted_invoice_url: "https://invoice.stripe.test/in_test",
    }));
  });

  test.afterEach(() => {
    for (const undo of restore.reverse()) undo();
    stub.uninstall();
    delete process.env.RESEND_API_KEY;
  });

  function signup(ip: string, fields: Record<string, string>) {
    const body = {
      parentName: "Pat Parent",
      email: "pat@example.com",
      phone: "301-555-0100",
      childFirstName: "Ava",
      childBirthYear: String(new Date().getFullYear() - 10),
      preferredTimes: "Tuesdays after 5",
      emergencyName: "Jo Parent",
      emergencyPhone: "301-555-0101",
      groupPlayers: "",
      allergies: "",
      notes: "",
      smsConsent: false,
      ...fields,
    };
    return checkoutLesson(
      new NextRequest("http://localhost/api/checkout-lesson", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
      }),
    );
  }

  function adminNotice(): string {
    const sends = stub.callsTo("api.resend.com");
    expect(sends).toHaveLength(1);
    return sends[0].body;
  }

  test("a private lesson invoices $75", async () => {
    const res = await signup("10.75.0.1", { lessonType: "private" });
    expect(res.status).toBe(200);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(7500);
    expect(items[0].description).toContain("$75");
    expect(adminNotice()).toContain("$75.00");
  });

  test("a group of four invoices $160 — $40 a player", async () => {
    const res = await signup("10.75.0.2", { lessonType: "group", groupPlayers: "4" });
    expect(res.status).toBe(200);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(16000);
    expect(items[0].description).toContain("4 players");
    expect(items[0].description).toContain("$40");
    expect(adminNotice()).toContain("$160.00");
  });

  test("a group of two invoices $80", async () => {
    const res = await signup("10.75.0.3", { lessonType: "group", groupPlayers: "2" });
    expect(res.status).toBe(200);
    expect(items.map((i) => i.amount)).toEqual([8000]);
  });

  test("no invoice line carries the retired $60 hour", async () => {
    await signup("10.75.0.4", { lessonType: "private" });
    await signup("10.75.0.4", { lessonType: "group", groupPlayers: "8" });
    expect(items.map((i) => i.amount)).toEqual([7500, 32000]);
    for (const item of items) expect(item.description).not.toMatch(/\$60(?!\d)/);
  });
});

test.describe("what a parent reads", () => {
  test("/lessons quotes $75 private and $40 per player", () => {
    const text = textOf(LessonsPage());
    expect(text).toContain("$75 / hour");
    expect(text).toContain("$40 / player");
    expect(text).toMatch(/\$40[^.]*per player/);
    expect(text).not.toMatch(/\$60(?!\d)/);
    expect(text).not.toMatch(/split between the players/);
  });

  test("the lesson cards carry the right price and unit", () => {
    expect(LESSON_PRODUCTS.private.priceUsd).toBe(PRIVATE_LESSON_PRICE_USD);
    expect(LESSON_PRODUCTS.private.priceUnit).toBe("hour");
    expect(LESSON_PRODUCTS.group.priceUsd).toBe(GROUP_LESSON_PRICE_PER_PLAYER_USD);
    expect(LESSON_PRODUCTS.group.priceUnit).toBe("player");
  });

  test("the cost FAQ quotes both lesson prices", () => {
    const cost = faq.find((f) => /How much do youth pickleball lessons cost/.test(f.question))!;
    expect(cost.answer).toContain("$75");
    expect(cost.answer).toMatch(/\$40 per player/);
    expect(cost.answer).not.toMatch(/\$60 total/);
  });

  test("the home-page 'train with a coach' card quotes both prices", () => {
    const text = textOf(IntentChooser());
    expect(text).toContain("$75");
    expect(text).toMatch(/\$40 per player/);
    expect(text).not.toMatch(/\$60(?!\d)/);
  });

  test("every lesson figure comes from src/data/lessons.ts, never a typed number", () => {
    for (const path of LESSON_SOURCES) {
      const src = readFileSync(join(__dirname, "..", "src", path), "utf8");
      expect(src, path).not.toMatch(/\$60(?!\d)/);
      if (path !== "data/lessons.ts") expect(src, path).not.toMatch(/\$\d/);
    }
  });
});
