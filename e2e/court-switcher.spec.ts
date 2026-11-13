import { test, expect } from "@playwright/test";
import { createElement, type ReactElement, type ReactNode } from "react";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import * as urls from "../src/lib/urls";
import { faq } from "../src/data/faq";
import { site } from "../src/data/site";
import { buildLlmsTxt } from "../src/lib/llms-txt";
import { POST } from "../src/app/api/analytics/route";
import { AfterStub } from "./fixtures/after-stub";

// The footer's court switcher: Sam's three sites drawn as service boxes on one
// court. This site's box is lit and is not a link; the other two leave the
// site in a new tab and say so. A fourth corner is one more list entry.

type Corner = { id: string; name: string; dest?: urls.FamilyDest };
// Read through the namespace so a missing export fails its own assertion.
const corners = ((urls as Record<string, unknown>).FAMILY_CORNERS ?? []) as readonly Corner[];
const load = createRequire(`${process.cwd()}/package.json`);

function switcherModule(): { default: () => ReactElement; COURT_SWITCHER_LABEL: string } {
  return load("./src/components/CourtSwitcher");
}

async function render(make: () => ReactNode): Promise<string> {
  const runtime = load("playwright/jsx-runtime");
  const original = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(make());
  } finally {
    Object.assign(runtime, original);
  }
}

const decode = (markup: string) => markup.replaceAll("&amp;", "&");
const text = (markup: string) => decode(markup.replace(/<[^>]*>/g, "")).trim();

interface Anchor { tag: string; href: URL; text: string }
function anchors(html: string): Anchor[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>[\s\S]*?<\/a>/g)].map((m) => ({
    tag: m[0].slice(0, m[0].indexOf(">") + 1),
    href: new URL(decode(m[1])),
    text: text(m[0]),
  }));
}
const boxes = (html: string) => [...html.matchAll(/<li\b[^>]*data-corner="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)]
  .map((m) => ({ id: m[1], inner: m[2] }));

test("the corner list is exactly Sam's three sites, in court order, names only", () => {
  expect(corners.map((c) => [c.id, c.name, c.dest])).toEqual([
    ["sammorrispb", "Coach Sam", "sammorrispb"],
    ["nga", "Next Gen Pickleball Academy", undefined],
    ["linkanddink", "Link & Dink", "linkanddink"],
  ]);
  for (const corner of corners) expect(Object.keys(corner).sort()).toEqual(corner.dest ? ["dest", "id", "name"] : ["id", "name"]);
});

test("the switcher renders three boxes: two outbound links around this site's lit box", async () => {
  const { default: CourtSwitcher, COURT_SWITCHER_LABEL } = switcherModule();
  const html = await render(() => createElement(CourtSwitcher));

  expect(html).toMatch(/^<nav\b/);
  expect(COURT_SWITCHER_LABEL.length).toBeGreaterThan(5);
  expect(decode(/^<nav\b[^>]*\baria-label="([^"]*)"/.exec(html)?.[1] ?? "")).toBe(COURT_SWITCHER_LABEL);

  const rendered = boxes(html);
  expect(rendered.map((b) => b.id)).toEqual(["sammorrispb", "nga", "linkanddink"]);
  expect(rendered.map((b) => text(b.inner).replace(" (opens in a new tab)", ""))).toEqual(
    ["Coach Sam", "Next Gen Pickleball Academy", "Link & Dink"],
  );

  const links = anchors(html);
  expect(links.map((a) => a.href.host)).toEqual(["sammorrispb.com", "www.linkanddink.com"]);
  for (const [i, dest] of (["sammorrispb", "linkanddink"] as const).entries()) {
    const link = links[i];
    expect(link.href.protocol).toBe("https:");
    expect(link.href.pathname).toBe("/");
    expect(Object.fromEntries(link.href.searchParams)).toEqual({
      utm_source: "nga",
      utm_medium: "cross_family_nav",
      utm_campaign: "family_reciprocal",
      utm_content: `switcher_${dest}`,
    });
    expect(link.tag).toContain('target="_blank"');
    expect(link.tag).toContain('rel="noopener noreferrer"');
    expect(link.text.endsWith("(opens in a new tab)")).toBe(true);
    // Each box is a full-width row at least 44px tall on a phone, and shows focus.
    expect(link.tag).toMatch(/\bmin-h-(11|12|14)\b/);
    expect(link.tag).toContain("focus-visible:outline");
    expect(link.tag).toContain("motion-reduce:transition-none");
  }
  const cue = /<span class="([^"]*)">[^<]*\(opens in a new tab\)<\/span>/.exec(html);
  expect(cue?.[1]).toBe("sr-only");

  // This site's box: marked current, and nothing a keyboard or pointer can follow.
  const current = rendered[1].inner;
  expect(current).toContain('aria-current="page"');
  expect(current).not.toMatch(/<a\b|href=|tabindex|role="link"|<button\b/i);
  expect(current).toMatch(/\bbg-ngpa-teal\b/);
  expect(current).toMatch(/\bmin-h-(11|12|14)\b/);
  expect(html.split('aria-current="page"')).toHaveLength(2);

  // Stacked on a phone, three across from the sm breakpoint, same order always.
  expect(html).toMatch(/\bgrid-cols-1\b/);
  expect(html).toMatch(/\bsm:grid-cols-3\b/);
  expect(html).not.toMatch(/\border-(first|last|\d)\b/);
});

test("Game On appears nowhere in the switcher, the corner list, or the family section of llms.txt", async () => {
  const { default: CourtSwitcher } = switcherModule();
  const html = await render(() => createElement(CourtSwitcher));
  const llms = buildLlmsTxt("2026-11-13");
  const family = llms.slice(llms.indexOf("## Family of sites"));
  const source = readFileSync("src/components/CourtSwitcher.tsx", "utf8");
  // Positive control: every haystack is real and carries the names it should.
  for (const haystack of [html, JSON.stringify(corners), family, source]) {
    expect(haystack.length).toBeGreaterThan(100);
    expect(/game\s*on/i.test(`${haystack} Game On`)).toBe(true);
  }
  for (const haystack of [html, JSON.stringify(corners), family]) expect(decode(haystack)).toContain("Link & Dink");
  for (const haystack of [html, JSON.stringify(corners), family, source]) expect(haystack).not.toMatch(/game\s*-?\s*on/i);
  expect(boxes(html)).toHaveLength(3);
});

test("the helper default is still footer_<dest> when no content is passed", () => {
  for (const dest of ["sammorrispb", "linkanddink"] as const) {
    expect(new URL(urls.familySiteUrl(dest)).searchParams.get("utm_content")).toBe(`footer_${dest}`);
    expect(new URL(urls.familySiteUrl(dest, "/")).searchParams.get("utm_content")).toBe(`footer_${dest}`);
    // Positive control: explicit content does change it, so the default is a real default.
    expect(new URL(urls.familySiteUrl(dest, "/", `switcher_${dest}`)).searchParams.get("utm_content")).toBe(`switcher_${dest}`);
  }
});

test("the footer mounts the switcher in place of the family pills and keeps Built by Sam Morris as it was", () => {
  const footer = readFileSync("src/components/Footer.tsx", "utf8");
  expect(footer).toContain("<CourtSwitcher />");
  expect(footer).not.toMatch(/FAMILY_LINKS|Part of the Sam Morris pickleball family|Adult lessons with Coach Sam|Free adult pickleball with Link/);
  // Built by Sam Morris: same helper call with no content, so it keeps footer_sammorrispb.
  expect(footer).toContain("Built by Sam Morris");
  expect(footer.split('familySiteUrl("sammorrispb")').length - 1).toBe(2);
  expect(footer).toContain('label: "built_by_sam_morris"');
  expect(footer).not.toContain("switcher_");
});

/* ---- taps: the click handler, the browser transport and the server proxy ---- */

// Walks the element tree the component returns. The spec's own JSX runtime is
// Playwright's, whose elements are plain objects, so match on shape rather
// than on React's element brand.
type El = { type: unknown; props: Record<string, unknown> };
function find(node: unknown, match: (el: El) => boolean, out: El[] = []): El[] {
  if (Array.isArray(node)) for (const child of node) find(child, match, out);
  else if (node && typeof node === "object" && "props" in node && "type" in node) {
    const el = node as El;
    if (match(el)) out.push(el);
    find(el.props.children, match, out);
  }
  return out;
}

const GLOBALS = ["window", "document", "navigator", "fetch"] as const;
const originals = new Map(GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const ENV = ["OPEN_BRAIN_ANALYTICS_URL", "LEAD_INGEST_TOKEN"] as const;
const savedEnv = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const after = new AfterStub();
const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

test.afterEach(() => {
  after.uninstall();
  for (const key of GLOBALS) {
    const descriptor = originals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  for (const key of ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("tapping a switcher box records an external_link event that survives both privacy guards and reaches the upstream", async () => {
  const beacons: Blob[] = [];
  const upstream: string[] = [];
  setGlobal("window", { location: { pathname: "/schedule" }, sessionStorage: { getItem: () => null } });
  // A returning visitor: the cookie puts ld_pid on the href, the longest URL this event carries.
  setGlobal("document", { cookie: "ld_visitor=3f2b6c1e-8d4a-4f6b-9a1c-2e5d7f8a9b0c", referrer: "" });
  setGlobal("navigator", { sendBeacon: (_url: string, body: Blob) => { beacons.push(body); return true; } });
  setGlobal("fetch", (_url: string, init: RequestInit) => { upstream.push(String(init.body)); return Promise.resolve(new Response(null, { status: 202 })); });
  process.env.OPEN_BRAIN_ANALYTICS_URL = "https://analytics.example.test/ingest";
  process.env.LEAD_INGEST_TOKEN = "synthetic-ingest-key";
  after.install();

  const { default: CourtSwitcher } = switcherModule();
  const links = find(CourtSwitcher(), (el) => el.type === "a");
  expect(links).toHaveLength(2);
  for (const link of links) (link.props.onClick as () => void)();
  expect(beacons).toHaveLength(2);

  for (const [i, dest] of (["sammorrispb", "linkanddink"] as const).entries()) {
    const body = JSON.parse(await beacons[i].text());
    const href = String(links[i].props.href);
    expect(new URL(href).searchParams.get("ld_pid")).toBe("3f2b6c1e-8d4a-4f6b-9a1c-2e5d7f8a9b0c");
    expect(body.event_name).toBe("external_link");
    expect(body.page).toBe("/schedule");
    expect(body.props).toMatchObject({ label: `switcher_${dest}`, url: href, page: "footer", business: "nga" });

    const response = await POST(new Request("https://nga.example.test/api/analytics", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(204);
    await after.run();
    expect(upstream).toHaveLength(i + 1);
    expect(JSON.parse(upstream[i])).toEqual(body);
  }
});

test("the WhatsApp footer tap also clears both privacy guards", async () => {
  // Loaded the same way the switcher module is: a dynamic import() of this
  // file resolved its named exports on some runs and not others.
  const { trackEvent } = load("./src/lib/funnelClient") as typeof import("../src/lib/funnelClient");
  expect(typeof trackEvent).toBe("function");
  const beacons: Blob[] = [];
  const upstream: string[] = [];
  setGlobal("window", { location: { pathname: "/" }, sessionStorage: { getItem: () => null } });
  setGlobal("document", { cookie: "ld_visitor=synthetic-visitor", referrer: "" });
  setGlobal("navigator", { sendBeacon: (_url: string, body: Blob) => { beacons.push(body); return true; } });
  setGlobal("fetch", (_url: string, init: RequestInit) => { upstream.push(String(init.body)); return Promise.resolve(new Response(null, { status: 202 })); });
  process.env.OPEN_BRAIN_ANALYTICS_URL = "https://analytics.example.test/ingest";
  process.env.LEAD_INGEST_TOKEN = "synthetic-ingest-key";
  after.install();

  trackEvent("cta_click", { label: "community_whatsapp_nga", destination: site.whatsapp, section: "footer" });
  expect(beacons).toHaveLength(1);
  await POST(new Request("https://nga.example.test/api/analytics", { method: "POST", body: await beacons[0].text() }));
  await after.run();
  expect(upstream).toHaveLength(1);
  expect(JSON.parse(upstream[0]).props.label).toBe("community_whatsapp_nga");
});

/* ------------------------------ llms.txt and FAQ ------------------------------ */

const flat = (s: string) => s.replace(/\s+/g, " ");

test("llms.txt lists the same three sites as the switcher and sends adult lessons to linkanddink.com", () => {
  const llms = buildLlmsTxt("2026-11-13");
  const start = llms.indexOf("## Family of sites");
  expect(start).toBeGreaterThan(0);
  const family = flat(llms.slice(start));
  const entries = llms.slice(start).split("\n- ").slice(1).map(flat);
  expect(entries).toHaveLength(3);
  // Same names, same order as the switcher.
  expect(corners).toHaveLength(3);
  for (const [i, corner] of corners.entries()) expect(entries[i]).toContain(corner.name);
  expect(entries[0]).toContain("https://sammorrispb.com");
  expect(entries[1]).toContain("https://nextgenpbacademy.com");
  expect(entries[2]).toContain("https://www.linkanddink.com");
  // Positive control for the "no longer says" checks below.
  expect(family).toContain("Link & Dink");

  expect(family).toContain("lesson request page on linkanddink.com");
  expect(family).toContain("https://coach.linkanddink.com/book/private-lesson");
  expect(flat(llms)).not.toMatch(/through sammorrispb\.com/i);
  expect(flat(llms)).not.toContain("Coach Sam Morris, adult private lessons.");
});

test("the adult-lessons FAQ answer names linkanddink.com and no longer says through sammorrispb.com", () => {
  const adult = faq.filter((item) => item.question === "Do you offer lessons for adults?");
  expect(adult).toHaveLength(1);
  const answer = adult[0].answer;
  expect(answer).toContain("Next Gen is youth-only (ages 6–16).");
  expect(answer).toContain("lesson request page on linkanddink.com");
  expect(answer).toContain("Sam confirms the time before sending your invoice.");
  expect(answer).not.toMatch(/through sammorrispb\.com|sammorrispb\.com|lesson scheduling page/);
  for (const item of faq) expect(item.answer, item.question).not.toMatch(/through sammorrispb\.com/);
});
