# SEO/AEO Backlog — nextgenpbacademy.com

Source of truth for the `seo-daily-sweep` agent. The agent reads this file each run,
picks the highest-priority `[ ]` item with the smallest size, ships one PR, then
moves the item to the **Done log** below.

## Status legend
`[ ]` open · `[~]` in-progress (claimed by today's run) · `[x]` done

## Task fields
- **Priority**: P0 (blocking) / P1 (high value) / P2 (nice-to-have)
- **Type**: schema / content / page / internal-link / technical
- **Size**: S (≤200 LOC diff) / M (200–400 LOC) / L (400+ — agent must split before claiming)

## Hard rules for any work on this repo
- Never reference Dill Dinkers, CourtReserve, linkanddink.com, or The Hub. NGA has relocated off DD facilities — no DD/CR cross-links anywhere.
- Never push to main directly — always PR.
- Never auto-merge.
- Each city page must have unique substance — coach POV per location, hand-written. No template duplication.
- Pricing: $35 drop-in only (Red), $45 (other tiers). Monthly subscription model is **retired** — never reference it. Source of truth: existing pricing components.
- `npm run build` must pass before PR.
- JSON-LD must validate via `seo-sweep-state/tools/validate-jsonld.mjs`.

---

## P0 — Foundation Sweep

- [ ] (schema, S) Create `src/lib/seo.ts` with `breadcrumbJsonLd(items)`, `faqJsonLd(qas)`, and `sportsEventJsonLd(session)` helpers. Mirror sammorrispb's helper API. These will be reused across all P0/P1/P2 tasks.
- [ ] (schema, S) Add `/yellowball/inquiry` to `src/app/sitemap.ts` (currently missing — sitemap has 5 of 7 routes). Keep `/schedule/success` excluded (post-conversion, intentional).
- [ ] (schema, S) Update `/schedule` `<title>` via `generateMetadata` to include "Montgomery County" — e.g. `"NGA Drop-in Schedule | Montgomery County Youth Pickleball"`. Currently omits the county and weakens local SEO.
- [ ] (schema, S) Add BreadcrumbList JSON-LD to `/`, `/schedule`, `/free-evaluation`, `/schools`, `/yellowball/inquiry`. (Already on `/montgomery-county-youth-pickleball`.)
- [ ] (schema, M) Add `SportsEvent` JSON-LD per session on `/schedule`. For each `NgaSession`: `name` (session title), `startDate`/`endDate` (ISO from session date + start/end times), `location` as Place with name + address (resolve via existing location data), `offers` ($35 USD, `availability` based on `s.status`), `maximumAttendeeCapacity` and `remainingAttendeeCapacity`, `sport: "Pickleball"`, `audience.suggestedMinAge`/`suggestedMaxAge` derived from level. Render inside the existing session `.map()` via the existing `<JsonLd>` component.
- [ ] (schema, S) Add `Service` JSON-LD to `/free-evaluation` (copy the pattern from `/schools/page.tsx`). Free evaluation as a Service offering with `provider`, `areaServed: "Montgomery County, MD"`, `audience: "EducationalAudience"` ages 5-16, `price: 0`.
- [ ] (schema, M) Add 4 `Course` JSON-LD entities on `/` (one per Red/Orange/Green/Yellow tier). Each with `provider` referencing the org, `educationalLevel`, `audience.suggestedMinAge`/`suggestedMaxAge`, `coursePrerequisites` (the prior tier name), `hasCourseInstance` linking to `/schedule`. Reuse data from the existing `LevelCard` / level rendering.

## P1 — Content Expansion (`/youth-pickleball-[city]` — 8 routes)

Cities approved for Phase 1: rockville, bethesda, north-bethesda, potomac, gaithersburg, silver-spring, germantown, olney.

- [ ] (page, M) Create `src/lib/cities.ts` if missing. Hand-written youth-pickleball POV per city (where NGA runs sessions, what the local context is). Sam's voice + NGA brand voice. Not generated.
- [ ] (page, M) Add `/youth-pickleball-rockville`. Mirror `/montgomery-county-youth-pickleball` template (already exists — has FAQPage + BreadcrumbList + Service). Reuse `LevelCard.tsx`/`LevelGrid.tsx`. Per-city 4-Q FAQ (where do you run sessions, what age, does my child need experience, how does Yellow Ball work). Service + LocalBusiness + Course schema. Cross-link to mocopb `/play/rockville` and sammorrispb `/lessons/rockville`. Register in sitemap.
- [ ] (page, M) Add `/youth-pickleball-bethesda`. Same template.
- [ ] (page, M) Add `/youth-pickleball-north-bethesda`. Same template.
- [ ] (page, M) Add `/youth-pickleball-potomac`. Same template.
- [ ] (page, M) Add `/youth-pickleball-gaithersburg`. Same template.
- [ ] (page, M) Add `/youth-pickleball-silver-spring`. Same template.
- [ ] (page, M) Add `/youth-pickleball-germantown`. Same template.
- [ ] (page, M) Add `/youth-pickleball-olney`. Same template.

## P2 — AEO Depth

- [ ] (page, M) Add `/tier-system` — full Red/Orange/Green/Yellow comparison page. `EducationalProgram` (parent) + 4 `Course` (children). HTML `<table>` comparison (skill criteria, age range, prerequisites, what they learn, when they advance). **Canonical source for "how does NGA's tier system work" — Perplexity gold.** Reuse `BallPathway.tsx` + `LevelGrid.tsx`.
- [ ] (page, M) Add `/how-to-register` — `HowTo` schema, 5-step (find session → click register → checkout → confirmation email → arrive at court). Embed the same HowTo block on `/schedule` for double exposure.
- [ ] (schema, S) Add `DefinedTerm` schema on home for "what is youth pickleball?". Definition + age range + tier system reference.
- [ ] (content, M) Expand FAQ coverage on `/`. Add 4-6 more Qs covering long-tail intent: "how is NGA different from rec league pickleball", "what do I bring to my first session", "how does the tier system progression work", "what age can my child start", "do you offer summer camps", "do you run school programs (link to /schools)".
- [ ] (internal-link, S) Cross-site `sameAs` audit: every `Organization`/`SportsActivityLocation` JSON-LD on this site references sammorrispb.com + mocopb.com in `sameAs`.

---

## Done log (auto-pruned at 30 days)

_(Empty — agent appends entries here as it ships PRs.)_
