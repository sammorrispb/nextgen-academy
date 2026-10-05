import { test, expect } from "@playwright/test";
import { createElement } from "react";
import * as reactJsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { blogPosts, findBlogPost } from "../src/data/blog";
import { faq } from "../src/data/faq";
import BlogPage, { generateMetadata } from "../src/app/blog/[slug]/page";
import CountyPage from "../src/app/montgomery-county-youth-pickleball/page";
import NorthBethesda from "../src/app/youth-pickleball-north-bethesda/page";
import FAQSection from "../src/components/FAQSection";
import { FALL_SEASON_GROUPS } from "../src/data/fall-season-2026";
import { MVF_AGE_MIN, MVF_AGE_MAX, NORTH_CREEK } from "../src/data/mvf";
import { PICKLPARK_LEAGUES } from "../src/data/picklpark-leagues-2026";
import { EVALUATION_SMS_URL } from "../src/data/scheduling";
const unsupported = /safest racket sports|USA Pickleball.{0,30}(?:official|youth progression)|fewer hard impacts|easier on small wrists|every group court is capped|every child starts with|before any group session|paddles and balls for (?:all|every) sessions?/i;
async function render(make: () => React.ReactNode | Promise<React.ReactNode>) {
  const runtime=createRequire(`${process.cwd()}/package.json`)("playwright/jsx-runtime");
  const original={...runtime};
  try{Object.assign(runtime,{jsx:reactJsx.jsx,jsxs:reactJsx.jsxs,Fragment:reactJsx.Fragment});return renderToStaticMarkup(await make());}
  finally{Object.assign(runtime,original);}
}
function text(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');}
function article(slug:string){return render(()=>BlogPage({params:Promise.resolve({slug})}));}
for(const post of blogPosts){
  test(`${post.slug}: rendered article and metadata are accurate without universal promises`,async()=>{
    const html=await article(post.slug); const visible=text(html);
    expect(visible+' '+post.description).not.toMatch(unsupported);
    expect(visible).not.toMatch(/sessions are one hour, drop-in|no subscription, no season commitment|closest|short drive|map of every public/);
    expect(visible).toMatch(/program.*(?:age|eligib)|listing.*(?:age|eligib)/i);
    expect(visible).toMatch(/free.*evaluation/i);
    expect(html).toContain(`href="${EVALUATION_SMS_URL}"`);
    const schema=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(x=>x['@type']==='BlogPosting');
    expect(schema.description).toBe(post.description); expect(schema.datePublished).toBe(post.datePublished);
    const meta=await generateMetadata({params:Promise.resolve({slug:post.slug})});
    expect(meta.alternates?.canonical).toBe(`/blog/${post.slug}`);expect(meta.description).toBe(post.description);expect(post.description.length).toBeLessThanOrEqual(160);
  });
}
test('article URLs and original publication dates remain stable',()=>{
  expect(blogPosts.map(p=>[p.slug,p.datePublished])).toEqual(expect.arrayContaining([
    ['is-pickleball-safe-for-kids','2026-07-25'],['youth-pickleball-ball-colors-explained','2026-07-25'],['where-kids-play-pickleball-montgomery-county','2026-07-25'],['first-pickleball-session-what-to-expect','2026-07-25'],['best-age-to-start-pickleball','2026-09-13'],['indoor-youth-pickleball-near-frederick-md','2026-09-13'],['pickleball-vs-tennis-for-a-7-year-old','2026-09-13']]));
  expect(new Set(blogPosts.map(p=>p.slug)).size).toBe(blogPosts.length);
});
test('county article names actual eligibility, booking owners, past camps and current-status links',async()=>{
  const post=findBlogPost('where-kids-play-pickleball-montgomery-county')!;const t=post.sections.flatMap(s=>s.paragraphs).join(' ');
  for(const g of FALL_SEASON_GROUPS)expect(t).toContain(g.label);
  expect(t).toMatch(/full season.*paid up front/);expect(t).toContain(NORTH_CREEK.name);expect(t).toContain(`${MVF_AGE_MIN}–${MVF_AGE_MAX}`);expect(t).toMatch(/register and pay.*MVF/);
  expect(t).toMatch(/summer camps.*ran|camps.*past/);expect(t).toMatch(/Wood.*past|past.*Wood/);
  const html=await article(post.slug);expect(html).toContain('href="/fall"');expect(html).toContain('href="/montgomery-village-youth-pickleball"');
});
test('first-session article distinguishes optional evaluation, duration, equipment, seasons and partner terms',()=>{
  const t=findBlogPost('first-pickleball-session-what-to-expect')!.sections.flatMap(s=>s.paragraphs).join(' ');
  expect(t).toMatch(/evaluation.*option|optional.*evaluation|evaluation.*can help/);
  expect(t).toMatch(/equipment.*listing|listing.*equipment/);expect(t).toMatch(/duration|length/);expect(t).toMatch(/group size/);
  expect(t).toMatch(/drop-in.*one session|drop-in.*single/);expect(t).toMatch(/season.*paid up front/);expect(t).toMatch(/partner.*terms|Partner.*terms/);
  expect(t).not.toMatch(/automatic full refund/);
});
test('Frederick article count and related link follow the real league data',()=>{
  const p=findBlogPost('indoor-youth-pickleball-near-frederick-md')!;const noun=PICKLPARK_LEAGUES.length===1?'league':'leagues';
  expect(p.description).toContain(`Saturday youth ${noun}`);expect(p.sections[1].heading).toContain(`Saturday ${noun}`);expect(p.links![1].label).toContain(`Saturday ${noun}`);
  expect(p.sections.flatMap(s=>s.paragraphs).join(' ')).toMatch(/Registration and payment go through The Pickl Park/);
});
test('safe/pathway/equipment FAQs render truthful, listing-specific answers',async()=>{
  const html=await render(()=>createElement(FAQSection));expect(text(html)).not.toMatch(unsupported);
  const safety=faq.find(x=>x.question==='Is pickleball safe for kids?')!.answer;
  expect(safety).toMatch(/age and skill/);expect(safety).toMatch(/group size and equipment/);
  const path=faq.find(x=>x.question.includes('difference between Red'))!.answer;
  expect(path).toMatch(/NGA|Next Gen/);expect(path).toMatch(/program.*ages|program.*age requirements/);
});
for(const [label,Page] of [['county',CountyPage],['city',NorthBethesda]] as const){
  test(`${label}: visible pathway and FAQ JSON-LD remove unsupported attribution`,async()=>{
    const html=await render(()=>createElement(Page));expect(text(html)).not.toMatch(/USA Pickleball.{0,30}official youth progression|safest racket sports/);
    const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
    const safety=schemas.find(s=>s['@type']==='FAQPage').mainEntity.find((q:{name:string})=>q.name==='Is pickleball safe for kids?').acceptedAnswer.text;
    expect(safety).toBe(faq.find(q=>q.question==='Is pickleball safe for kids?')!.answer);
  });
}
test('empty and unknown article requests never invent a program or article',async()=>{
  for(const slug of ['', 'unknown-article']){expect(findBlogPost(slug)).toBeUndefined();expect(await generateMetadata({params:Promise.resolve({slug})})).toEqual({});await expect(BlogPage({params:Promise.resolve({slug})})).rejects.toThrow(/404/);}
});
