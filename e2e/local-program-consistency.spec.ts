import { test, expect } from "@playwright/test";
import { createElement } from "react";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import NorthBethesda, { metadata as northBethesdaMeta } from "../src/app/youth-pickleball-north-bethesda/page";
import Rockville, { metadata as rockvilleMeta } from "../src/app/youth-pickleball-rockville/page";
import Potomac, { metadata as potomacMeta } from "../src/app/youth-pickleball-potomac/page";
import Gaithersburg, { metadata as gaithersburgMeta } from "../src/app/youth-pickleball-gaithersburg/page";
import Germantown, { metadata as germantownMeta } from "../src/app/youth-pickleball-germantown/page";
import SilverSpring, { metadata as silverSpringMeta } from "../src/app/youth-pickleball-silver-spring/page";
import Olney, { metadata as olneyMeta } from "../src/app/youth-pickleball-olney/page";
import Bethesda from "../src/app/youth-pickleball-bethesda/page";
import { FALL_SEASON_GROUPS } from "../src/data/fall-season-2026";
import { MVF_AGE_MIN, MVF_AGE_MAX, NORTH_CREEK } from "../src/data/mvf";

function render(Page: () => React.JSX.Element) {
  const runtime = createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const original = { ...runtime };
  try {
    Object.assign(runtime, { jsx: reactJsx.jsx, jsxs: reactJsx.jsxs, Fragment: reactJsx.Fragment });
    return renderToStaticMarkup(createElement(Page));
  } finally { Object.assign(runtime, original); }
}
function visible(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "").replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}
const cities = [
  { city: "North Bethesda", slug: "north-bethesda", Page: NorthBethesda, meta: northBethesdaMeta, href: "/fall" },
  { city: "Rockville", slug: "rockville", Page: Rockville, meta: rockvilleMeta, href: "/montgomery-county-youth-pickleball#programs" },
  { city: "Potomac", slug: "potomac", Page: Potomac, meta: potomacMeta, href: "/fall" },
  { city: "Gaithersburg", slug: "gaithersburg", Page: Gaithersburg, meta: gaithersburgMeta, href: "/montgomery-village-youth-pickleball" },
  { city: "Germantown", slug: "germantown", Page: Germantown, meta: germantownMeta, href: "/montgomery-village-youth-pickleball" },
  { city: "Silver Spring", slug: "silver-spring", Page: SilverSpring, meta: silverSpringMeta, href: "/montgomery-county-youth-pickleball#programs" },
  { city: "Olney", slug: "olney", Page: Olney, meta: olneyMeta, href: "/montgomery-county-youth-pickleball#programs" },
];
for (const { city, slug, Page, meta, href } of cities) {
  test(`${city}: accurate service-area metadata, canonical and actual program destination`, () => {
    expect(meta.description).toMatch(/families/);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.alternates?.canonical).toBe(`/youth-pickleball-${slug}`);
    expect(render(Page)).toContain(`href="${href}"`);
  });
  test(`${city}: rendered guide avoids nearest-venue and universal format promises`, () => {
    const text = visible(render(Page));
    expect(text).not.toMatch(/closest|minutes from|few minutes|short drive|easy ride|one court per level|court for every level|four players per court|same format everywhere|pay per session with no subscription|closest programs today/i);
    expect(text).toMatch(/Each program listing|each program.*ages|program.*eligibility/i);
    expect(text).toMatch(/confirm.*court|court.*confirm/i);
  });
  test(`${city}: planned cluster is visibly an interest list`, () => {
    const html = render(Page);
    const callout = html.match(/<section[^>]*data-testid="cluster-callout"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    expect(callout).toBeTruthy();
    expect(visible(callout!)).toMatch(/Interest list/);
    expect(visible(callout!)).not.toMatch(/families train with|Coming Fall 2026|families get/);
  });
  test(`${city}: local FAQ matches the visible guide without active historical venues`, () => {
    const html=render(Page);
    const faq=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(x=>x['@type']==='FAQPage');
    const answer=faq.mainEntity[0].acceptedAnswer.text;
    expect(answer).not.toMatch(/closest|camp weeks run|weekly weekend.*currently run in Rockville|this week.s slots/i);
    expect(visible(html)).toContain(answer.replace(/\s+/g," "));
  });
}
for(const Page of [NorthBethesda,Potomac,Bethesda]) {
  test(`${Page.name}: Bethesda season retains actual groups and full-block terms`,()=>{
    const text=visible(render(Page));
    expect(text).toContain('Walter Johnson'); expect(text).toContain('Bethesda');
    for(const group of FALL_SEASON_GROUPS) expect(text).toContain(group.label);
    expect(text).toMatch(/full season|full block/); expect(text).toMatch(/paid up front/);
    expect(text).not.toMatch(/drop in session by session|no subscription or commitment/);
  });
}
for(const Page of [Gaithersburg,Germantown]) {
  test(`${Page.name}: partner venue, eligibility and booking owner are explicit`,()=>{
    const text=visible(render(Page));
    expect(text).toContain(NORTH_CREEK.name); expect(text).toContain(NORTH_CREEK.locality);
    expect(text).toContain(`${MVF_AGE_MIN}–${MVF_AGE_MAX}`);
    expect(text).toMatch(/register and pay.*MVF|MVF.*registration and payment/);
    expect(text).toMatch(/confirm.*MVF|MVF.*confirm/);
    expect(text).not.toMatch(/Apple Ridge.*intro/);
  });
}
test('historical schools and camps remain clearly past; Frederick referral survives',()=>{
  for(const Page of [Rockville,SilverSpring,Olney,Gaithersburg]) expect(visible(render(Page))).toMatch(/past seasons|past programs|2026 summer camps.*ran/);
  expect(render(Germantown)).toContain('href="/youth-pickleball-frederick"');
});
