import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { submissionKeyFor, parseSubmissionId } from "../src/lib/submission-key";

// The client half of the one-submission-one-invoice invariant (the server
// half is invariant-signup-invoice-idempotency.spec.ts). The id a sign-up
// form sends becomes Stripe's Idempotency-Key, so it must be the SAME for a
// retry of the same content — a dropped connection, the resubmit after the
// inline waiver — and NEW for changed content, because Stripe rejects a key
// reused with a different request. The MVF, lesson, Monday Girls drop-in and
// Winter League forms all minted a fresh crypto.randomUUID() per attempt, so
// every retry was a brand-new invoice.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test.describe("submissionKeyFor — one key per distinct form content", () => {
  const form = { division: "10u", email: "pat@example.com", childFirstName: "Ava" };

  test("resubmitting the same content reuses its key", () => {
    const issued = new Map<string, string>();
    const first = submissionKeyFor(issued, form);
    expect(submissionKeyFor(issued, { ...form })).toBe(first);
  });

  test("changed content gets a new key", () => {
    const issued = new Map<string, string>();
    const first = submissionKeyFor(issued, form);
    expect(submissionKeyFor(issued, { ...form, childFirstName: "Max" })).not.toBe(first);
  });

  test("reverting an edit returns to the original key, so it replays the original invoice", () => {
    const issued = new Map<string, string>();
    const original = submissionKeyFor(issued, form);
    submissionKeyFor(issued, { ...form, division: "14u" });
    expect(submissionKeyFor(issued, form)).toBe(original);
  });

  test("a fresh page load starts fresh — separate maps never share a key", () => {
    expect(submissionKeyFor(new Map(), form)).not.toBe(submissionKeyFor(new Map(), form));
  });

  test("the key is random, never built from the form (Stripe: no personal data in keys)", () => {
    const key = submissionKeyFor(new Map(), form);
    expect(key).toMatch(UUID);
    for (const value of Object.values(form)) expect(key).not.toContain(value);
  });
});

test.describe("parseSubmissionId — the server only uses an id shaped like the ones the forms mint", () => {
  test("a UUID passes through", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(parseSubmissionId(id)).toBe(id);
  });

  test("anything else is no key at all (never a rejected sign-up)", () => {
    for (const bad of [undefined, null, "", 42, {}, "not-a-uuid", "x".repeat(300),
      "11111111-1111-4111-8111-111111111111 ", "11111111-1111-4111-8111-111111111111-extra"]) {
      expect(parseSubmissionId(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Wiring. Discovered, not listed: every route that invoices through
// createAndSendSignupInvoice, and every component that posts to one — so a
// restored form (the Winter League one deleted in #362 had the same bug) or a
// new invoice route is checked the day it lands.

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const read = (path: string) => readFileSync(path, "utf8");

const invoiceRoutes = walk(join(SRC, "app", "api"))
  .filter((f) => f.endsWith("route.ts"))
  .filter((f) =>
    /import\s*\{[^}]*\bcreateAndSendSignupInvoice\b[^}]*\}\s*from\s*"@\/lib\/stripe-invoices"/.test(read(f)),
  )
  .map((file) => ({
    file,
    apiPath: "/" + relative(join(SRC, "app"), file).replace(/\/route\.ts$/, ""),
  }));

const forms = walk(SRC)
  .filter((f) => f.endsWith(".tsx"))
  .flatMap((file) => {
    const src = read(file);
    const route = invoiceRoutes.find((r) => new RegExp(`fetch\\(\\s*["'\`]${r.apiPath}["'\`]`).test(src));
    return route ? [{ file, src, route }] : [];
  });

/** Index just past the `}` that closes the first `{` at or after `from`. */
function blockEnd(src: string, from: number): number {
  const open = src.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i + 1;
  }
  throw new Error("unbalanced braces");
}

test.describe("every invoice sign-up form keeps its key across retries", () => {
  test("the discovery finds the invoice routes and their forms (so the checks below can fail)", () => {
    expect(invoiceRoutes.map((r) => r.apiPath).sort()).toEqual(
      expect.arrayContaining(["/api/checkout-monday-girls-dropin", "/api/checkout-mvf-junior-tournament"]),
    );
    expect(forms.map((f) => relative(SRC, f.file)).sort()).toEqual(
      expect.arrayContaining(["components/MondayGirlsDropinForm.tsx", "components/MvfJuniorTournamentForm.tsx"]),
    );
  });

  for (const { file, src, route } of forms) {
    test(`${relative(SRC, file)} → ${route.apiPath}: the id comes from a map that lives as long as the page`, () => {
      // A Map created per call would mint a new key every submit — the bug,
      // with the helper's name on it — so pin the ref AND the call.
      const ref = src.match(/const\s+(\w+)\s*=\s*useRef\(\s*new Map</)?.[1];
      expect(ref, "a useRef(new Map...) holding issued keys").toBeTruthy();
      expect(src).toMatch(new RegExp(`submissionId:\\s*submissionKeyFor\\(\\s*${ref}\\.current\\s*,\\s*form\\s*\\)`));
      expect(src, "no id minted per attempt").not.toMatch(/crypto\.randomUUID\(/);
    });
  }
});

test.describe("every invoice route takes only a well-formed id and announces an invoice once", () => {
  test("there are invoice routes to check", () => {
    expect(invoiceRoutes.length).toBeGreaterThanOrEqual(3);
  });

  for (const { file, apiPath } of invoiceRoutes) {
    test(`${apiPath}: parses the id, and every "invoice sent" announcement is skipped on a replay`, () => {
      const src = read(file);
      expect(src).toMatch(/const\s+submissionId\s*=\s*parseSubmissionId\(\s*body\.submissionId\s*\)/);

      const postStart = src.indexOf("export async function POST");
      expect(postStart).toBeGreaterThanOrEqual(0);
      const post = src.slice(postStart, blockEnd(src, postStart));

      const guards: Array<[number, number]> = [];
      for (const m of post.matchAll(/if\s*\(\s*!alreadySent\s*\)\s*\{/g)) {
        guards.push([m.index, blockEnd(post, m.index)]);
      }
      const announcements = [...post.matchAll(/\b(notifyInvoiceSent|notifyAdminInvoiceSent)\(|\.emails\.send\(/g)];
      expect(announcements.length, "announcements found (else this check is vacuous)").toBeGreaterThan(0);
      for (const a of announcements) {
        const guarded = guards.some(([start, end]) => a.index > start && a.index < end);
        expect(guarded, `${a[0]} at offset ${a.index} runs even when Stripe replayed the send`).toBe(true);
      }
    });
  }
});
