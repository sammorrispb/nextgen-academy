import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * One brand per <title> (AEO audit, 2026-09-13).
 *
 * The root layout's title template is "%s | Next Gen Pickleball Academy". A
 * page that exports a PLAIN-STRING title gets that suffix appended, so any
 * plain string that already names the brand renders it twice —
 * "/fall" was serving "Fall 2026 Season — Register | Next Gen Pickleball
 * Academy | Next Gen Pickleball Academy" (87 chars, truncated by Google).
 *
 * Rule: a plain-string title is the page part only and never contains
 * "Next Gen". A page that wants the brand in a specific form uses
 * `{ absolute: "…" }`, which bypasses the template.
 *
 * openGraph/twitter titles are exempt (no template applies there), as are the
 * coach, admin, and signed-link standings surfaces (noindex, and standings is
 * a Slop-Free minor-PII zone this change does not touch).
 *
 * Mutation check: restore the old /crew title
 * ("Find your kid's pickleball crew — Next Gen, Montgomery County, MD") → red.
 */

const APP = join(__dirname, "..", "src", "app");
const EXEMPT = [/^coach\//, /^admin\//, /^fall\/standings\//];

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pageFiles(p));
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}

/** Remove `openGraph: { … }` and `twitter: { … }` blocks (brace-balanced). */
function stripSocialBlocks(src: string): string {
  let out = src;
  for (const key of ["openGraph", "twitter"]) {
    let idx = out.indexOf(`${key}: {`);
    while (idx !== -1) {
      let depth = 0;
      let end = idx + key.length + 2;
      for (; end < out.length; end++) {
        if (out[end] === "{") depth++;
        else if (out[end] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      out = out.slice(0, idx) + out.slice(end + 1);
      idx = out.indexOf(`${key}: {`);
    }
  }
  return out;
}

test.describe("page titles carry the brand once", () => {
  const files = pageFiles(APP).filter(
    (f) => !EXEMPT.some((re) => re.test(relative(APP, f).split("\\").join("/"))),
  );

  test("the walk actually found the pages it guards", () => {
    // A guard that scans nothing passes forever — pin the reader.
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((f) => f.endsWith(join("crew", "page.tsx")))).toBe(true);
  });

  test("no plain-string metadata title contains 'Next Gen'", () => {
    const offenders: string[] = [];
    const TITLE = /^\s*title:\s*(["'`])(.*?)\1\s*,?\s*$/gm;
    for (const file of files) {
      const src = stripSocialBlocks(readFileSync(file, "utf8"));
      for (const m of src.matchAll(TITLE)) {
        if (/Next Gen/.test(m[2])) {
          offenders.push(`${relative(APP, file)}: ${m[2]}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
