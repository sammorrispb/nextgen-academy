# Montgomery County Discovery Review — Traffic, SEO & AEO (July 2026)

Reviewed 2026-07-23. Covers nextgenpbacademy.com (parents/kids) and the Link & Dink
family (players) — the L&D-side companion actions live in
`community-os/docs/SEO_AEO_REVIEW_2026-07.md`. Sources: live-site checks (robots,
sitemaps, llms.txt, SERPs), full repo audits of both codebases, and funnel outcomes
from the Notion CRMs + Open Brain (no pageview analytics exist — see §1).

---

## 1. Traffic reality: we are flying without pageview data

- **NGA has zero traffic analytics by policy** — `verify-funnel.mjs` bans GA4, Meta
  Pixel, and `@vercel/analytics`. That policy is sound (COPPA posture, no pixels),
  but it means the only measurable "traffic" is funnel outcomes.
- **Google Search Console is verified** (token in `src/app/layout.tsx`) but nothing
  in the operating routine reads it. GSC is privacy-clean (it's Google's own crawl
  data, no on-site pixel) and is currently the only window into impressions,
  queries, and rankings. It is unused.
- **Link & Dink mounts `<Analytics />` in every app layout, but the Vercel Web
  Analytics feature is not enabled on any Vercel project** (API returns "Web
  Analytics not found" for ld-www, popup-pickleball, ld-coach, nextgen-academy).
  L&D's cookieless page-view data is being silently dropped.

### Funnel outcomes (the numbers we do have, as of 2026-07-23)

| Metric | Value | Note |
|---|---|---|
| NGA lead CRM total | 399 rows | 197 have no Source set |
| NGA organic lead run-rate | ~12–18/mo (20 in last 30d) | Jan/Mar spikes were bulk imports |
| Lead sources (where set) | Website 79 · Lead Form 11 · Contact Form 9 · Facebook Ad 6 · chatgpt.com 1 · Peachjar test 1 | Referral: **0** |
| NGA newsletter | **17 subscribers** (16 active), 4 in last 30d | Referral loop: **0 referred signups** |
| NGA session fill | **~3%** (4 registered / 136 seats across 34 open sessions) | Jul 1–22: 37 sessions, only 3 had any registration |
| NGA drop-ins all-time | 37 registrations, ~20 unique families | 16 in last 30d — volume is recent and growing |
| Crew Interest | 3 rows, all Status=New | |
| L&D organic new players | ~33 in last 30d (1,010 total; 944 were a 6/25 backfill) | |
| L&D organic newsletter signups | ~7 in last 30d (975 total; 955 backfilled 6/27) | |
| L&D events, last 30d | 16 events · 69 RSVPs · 33 check-ins | ~4.3 RSVPs/event |

**Read:** supply massively exceeds discovery. 136 open youth seats with a 3% fill
rate, and L&D events averaging ~4 RSVPs, is not a product problem — the sessions
that do get found convert (16 paid drop-ins in 30 days from ~20 families). The
bottleneck is reach.

One genuinely encouraging signal: a lead already arrived attributed to
**chatgpt.com** — the answer-engine channel is real and already producing.

---

## 2. SEO — where we stand in the SERPs (checked live 2026-07-23)

### NGA: already ranking, under-exploited
- "youth pickleball Montgomery County Maryland kids lessons" → **3 page-1 results**
  (home, /schedule, /montgomery-county-youth-pickleball).
- "kids pickleball lessons Rockville MD" → 3 page-1 results.
- "youth pickleball summer camp Montgomery County MD 2026" → /schedule + home on page 1.
- **But the indexed snippets are stale**: Google is still serving DD-era copy —
  "Ages 5–16", "classes at Dill Dinkers Rockville and North Bethesda", weeknight
  rotation copy. The live pages are correct (verified: titles say 6–16, no DD).
  Google simply hasn't re-crawled since the June policy changes. This misrepresents
  the offering to every searcher today.

### Link & Dink: invisible except when named
- "pickleball tournaments Montgomery County MD open play adults" → **no L&D result
  anywhere**. County Rec, YMCA, places2play, playtimescheduler own the page.
- ""Link and Dink" pickleball Maryland" (branded) → ranks fine.
- Bright spot: **the per-court map pages already rank** — `/map/takoma-park-community-center`
  appears on page 1 for "pickleball courts Montgomery County MD map public". The
  programmatic court directory (71 courts, geo JSON-LD) is L&D's strongest SEO asset.

### Who owns the local SERPs (and where we're absent)
Directories and institutions: montgomerycountymd.gov Rec, montgomeryparks.org,
rockvillemd.gov, TeachMe.To, Swimply, Global Pickleball Network,
mypickleballlessons.com, places2play.org, playtimescheduler.com, KrazyPickles,
CourtSource, JumpStart Sports. NGA/L&D are listed in **none** of them.

**Neither NGA nor L&D has a Google Business Profile.** No Maps pin, no reviews, no
presence in the local pack — which is where "pickleball lessons for kids near me"
searches actually resolve. This is the single biggest discovery gap.

Flag: `pickleballclimb5.com` publishes "Courts in Montgomery County, MD |
Pickleball Climb 5.0 with Sam Morris." If that isn't Sam's, someone is trading on
the name; verify and act either way.

---

## 3. On-site SEO audit — nextgenpbacademy.com

### Strong
- Clean metadata everywhere: metadataBase, per-page canonicals, `{absolute}` titles
  under 60 chars, OG/Twitter cards, dynamic 1200×630 OG image.
- Canonical-host 301 (www→apex), full legacy-Squarespace redirect map, anchor
  consolidation redirects.
- Rich JSON-LD: site-wide SportsActivityLocation; home FAQPage (15 Qs) + Person per
  coach + SportsEvent per session; LocalBusiness on all local pages; Course on
  /schedule; SportsEvent+Offer on MVF; Service+FAQPage on /schools.
- 11 local landing pages (county hub + MVF + 8 city pages) + 4 cluster pages, all
  in the sitemap with sane priorities.
- GSC verified; robots + sitemap correct in shape.

### Gaps (ranked by impact)
1. **9 of 11 local landing pages are orphaned.** The 8 `/youth-pickleball-{city}`
   pages and `/montgomery-county-youth-pickleball` have **zero inbound HTML links**
   — not in the navbar, footer, or any page body. They exist only in the sitemap
   and JSON-LD breadcrumbs. Orphaned pages get crawled less, rank worse, and pass
   no internal authority.
2. **City pages are ~75% template duplicate.** Only ~110 of ~430 words differ per
   city; all 8 share the identical 4-question FAQ and testimonials.
   `seo-backlog.md` itself requires unique substance per city — not met. Thin
   near-duplicates risk being ignored (or filtered) rather than ranked.
3. **`/crew`, `/league`, `/camp` are missing from the sitemap** despite being
   public, fully-metadata'd marketing pages. `/camp` matters *now* (summer intent
   is live and searchers are finding /schedule instead of the camp page).
4. **Stale index**: no re-crawl since the June changes (see §2).
5. **No AEO surface at all**: no `llms.txt`, no `.well-known`, and the one
   machine-readable feed (`/api/sessions/feed`) is blocked by `Disallow: /api/`.
   NGA is invisible to agents except via JSON-LD — while sibling L&D has 8
   llms.txt hosts and ~30 open JSON feeds. (L&D's `/api/schedule/feed` already
   republishes NGA sessions — that's currently NGA's only agent surface.)
6. **No indexable evergreen content.** The entire news pipeline (scraper → Notion
   triage → newsletter) outputs email only. Zero blog/article URLs to earn
   long-tail queries ("is pickleball safe for kids", "best pickleball paddle for a
   10 year old", "pickleball birthday party MoCo"...).
7. Smaller: `/free-evaluation` lacks its intended Service JSON-LD; `/yellowball/inquiry`
   and `/waiver` have no canonical; favicon is the OG PNG (no dedicated
   favicon/manifest); `robots.ts` doesn't disallow `/coach/`; `seo-backlog.md`
   still says $35/$45 pricing (live is $20) and BRAND_GUIDELINES still shows
   `data-age-min="5"` (floor is 6, and seo.spec.ts enforces it).

## 4. On-site SEO/AEO audit — Link & Dink (summary; details in community-os doc)

Strong: best-in-class AEO (8 llms.txt hosts with `.well-known` mirrors, ~30
redacted CORS-open JSON feeds, geo-anchored Event/SportsActivityLocation/
Person/JobPosting/FAQPage JSON-LD, an SEO contract test); indexable newsletter
archive + blog; the ranking court directory; p3 event pages with real
GeoCoordinates and honest organizer attribution.

Gaps: no query-shaped landing pages ("pickleball tournaments Montgomery County",
"open play", "beginner pickleball") — p3 events are dated one-offs that never
accumulate ranking power; Web Analytics feature not enabled (data dropped); the
future apex app has no robots/sitemap/JSON-LD yet; no GBP.

---

## 5. The Plan — reach more MoCo players and parents

Ordered by leverage per unit of effort. Phases 1–2 are days, not weeks.

### Phase 1 — Code quick wins (NGA repo, one PR, ~a day)
1. **De-orphan the local pages.** Add an "Areas we serve" link block to the footer
   (all 8 city pages + county hub) and link the county hub from the home `#faq`
   answer for "Which Montgomery County towns do you serve?". Cross-link each city
   page to its 2–3 neighbor cities.
2. **Sitemap: add `/crew`, `/league`, `/camp`** (and `/camp/[slug]` while camps
   are live).
3. **Ship `llms.txt`** (+ `.well-known` mirror) reusing L&D's `renderLlmsTxt`
   pattern: advertise `/api/sessions/feed`, the lead-form contract, brand
   promises, and the no-fabrication pledge. Add `Allow: /api/sessions/feed` to
   robots. This is cheap — the feed already exists.
4. Small fixes: Service JSON-LD on `/free-evaluation`; canonicals on
   `/yellowball/inquiry` + `/waiver`; `Disallow: /coach/` in robots; real favicon;
   correct `seo-backlog.md` pricing + BRAND_GUIDELINES age example.

### Phase 2 — Ops/accounts (Sam-led, no code, ~2–3 hours total)
5. **Create Google Business Profiles** — "Next Gen Pickleball Academy" as a
   service-area business (Montgomery County; category Sports school / Youth
   sports), and "Link & Dink" (Sports club). Then ask every current family for a
   review (20 families ≈ enough to own the youth-pickleball local pack in MoCo,
   which today has no incumbent). Repeat on Bing Places + Apple Business Connect.
6. **GSC re-crawl**: request indexing for `/`, `/schedule`,
   `/montgomery-county-youth-pickleball`, `/camp` to purge the DD-era/"ages 5–16"
   snippets. Submit the sitemap in Bing Webmaster Tools too.
7. **Directory listings** (each is a page-1 SERP occupant today): TeachMe.To coach
   profile, Global Pickleball Network lessons listing, mypickleballlessons.com,
   places2play.org, playtimescheduler.com (post L&D open-play events),
   KrazyPickles + CourtSource (pitch the L&D court map as a data source — link
   earn). JumpStart Sports ends at age 12; NGA picks up at 6–16 — a referral
   conversation, not a rivalry.
8. **Enable Vercel Web Analytics** on the four community-os projects (component
   already mounted; it's cookieless). For NGA, the pixel ban is policy — decide
   explicitly (IPAV) whether cookieless first-party counts stay banned; GSC
   works either way.
9. **Verify/claim `pickleballclimb5.com`** ("Sam Morris" branded courts page).

### Phase 3 — Content engine (1–2 weeks, then steady-state)
10. **Differentiate the 8 city pages.** Per city: name the actual venues from
    `recurring-templates.ts`/history (Wood MS, Walter Johnson HS...), drive time
    from that city, city-specific FAQ answers, city-relevant testimonial. Target
    ≥300 unique words each. The pages, titles, and sitemap plumbing already exist
    — this is copy work.
11. **Turn the news pipeline into a public blog.** The Tue radar → Wed drafter →
    Sam-approves flow already produces reviewed, Coach-voice sections weekly that
    die in email. Add `/blog` that renders the same Approved Notion rows as
    indexable articles (Article JSON-LD, canonical). Zero new writing burden;
    hand-write 4 evergreen cornerstone posts once ("Is pickleball safe for kids?",
    "Red/Orange/Green/Yellow explained", "Where kids can play in MoCo",
    "First lesson: what to expect").
12. **L&D query-shaped pages** (community-os): `/tournaments` and `/open-play`
    evergreen pages fed by the existing feeds — pages that *accumulate* rank while
    dated p3 events rotate beneath them. Details in the companion doc.
13. **Weekend schedule freshness**: keep /schedule's SportsEvent JSON-LD dense
    through the Sat/Sun (Wood MS / Walter Johnson) era — it's what feeds both
    Google events surfaces and the L&D combined feed.

### Phase 4 — Local distribution & referral (ongoing)
14. **Peachjar school flyers.** A `peachjar-test` lead already exists in the CRM —
    finish the experiment. MCPS e-flyer distribution reaches exactly the parent
    audience, per-school, cheaply.
15. **Local press.** Axios DC already covered MCPS making pickleball a varsity
    sport; L&D has `/hs`. Pitch MoCo360, Bethesda Magazine, Patch, Source of the
    Spring: "two dads built a youth pickleball pathway + free community platform
    in MoCo" is a real local story and each placement is a high-authority local
    backlink.
16. **Activate the referral loop** (built, 0 uses): put the referral link in the
    post-session email and eval confirmation (not just the newsletter that 17
    people receive), add a QR card at sessions/camps.
17. **Grow the newsletter from 17.** Sign-up prompt in post-eval and post-session
    emails; QR at check-in; the eval-reengagement endpoint (dry-run first) against
    the ~50-lead eligible pool.
18. **Cross-side funnel**: L&D weekly (975 subs) regularly features NGA youth
    sessions to parents who already play; NGA footer already reciprocates. The
    imbalance (975 vs 17) makes L&D→NGA the productive direction.

### Phase 5 — Measurement loop (so this compounds)
19. **Weekly GSC review** (queries, impressions, positions; the only clean traffic
    lens for NGA). Wire as a cloud routine that posts a summary to Slack/Notion.
20. **Monthly funnel snapshot** from the same Notion/OB numbers as §1 —
    leads/mo, subscribers, fill %, GBP actions, L&D RSVPs — tracked against:

| KPI | Now | 90-day target |
|---|---|---|
| NGA organic leads/mo | ~12–18 | 40 |
| NGA newsletter actives | 16 | 100 |
| NGA session fill | ~3% | 25% |
| NGA GBP reviews | 0 (no profile) | 15 |
| L&D organic signups/mo | ~7 | 50 |
| Avg RSVPs per L&D event | ~4.3 | 8 |

---

## Appendix — evidence sources
- SERP checks 2026-07-23 (queries in §2), live robots/sitemap/llms.txt fetches.
- Repo audits: nextgen-academy (metadata/sitemap/JSON-LD/internal-link graph),
  community-os (AGENT_FRIENDLY charter, per-app SEO surface).
- Funnel: NGA Player DB, Newsletter Subscribers, Sessions Schedule, Drop-in
  Registrations, Crew Interest (Notion); `ld.*`/`community.*` via Open Brain
  `query_ld`; `pipeline_report`/`contact_stats`.
- Vercel API: Web Analytics disabled on all projects.
