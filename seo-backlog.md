# SEO/AEO Backlog — nextgenpbacademy.com

Source of truth for the `seo-daily-sweep` agent **when it runs**. As of
2026-09-13 the sweep is **paused** for every site in `seo-sweep-state/state.json`
(Sam's call — personal-site SEO is shelved this quarter). Un-pausing is Sam's
decision; see `~/.claude/skills-tier-registry.md`. Until then this file is a
plain backlog for hand-shipped work.

## Status legend
`[ ]` open · `[~]` in-progress · `[x]` done

## Task fields
- **Priority**: P0 (blocking) / P1 (high value) / P2 (nice-to-have)
- **Type**: schema / content / page / internal-link / technical
- **Size**: S (≤200 LOC diff) / M (200–400 LOC) / L (400+ — split before claiming)

## Hard rules for any work on this repo
- Never reference Dill Dinkers, CourtReserve, or The Hub. NGA has relocated off DD facilities — no DD/CR cross-links anywhere. (`linkanddink.com` is a Sam Morris family brand, referenced in JSON-LD `sameAs` — family cross-links are allowed.)
- Never push to main directly — always PR.
- Each city page must have unique substance — coach POV per location, hand-written. No template duplication.
- **Pricing:** the drop-in rate is never printed on any public surface (Sam, 2026-09-08) — parents see it at Stripe checkout. Season and camp products quote their real Stripe price, derived from their data file. The Pickl Park and MVF set and show their own prices; never quote them. Pinned by `e2e/invariant-dropin-price-not-quoted.spec.ts`.
- **Out-of-county pages** (Frederick) claim only what NGA runs there — see `src/data/frederick.ts`. Never the 6–16 ladder, never a free evaluation at a Frederick venue, never testimonials that don't exist.
- **One organization entity:** every JSON-LD node references the org via `orgRef()` from `src/lib/seo.ts`. Never hand-write an inline `SportsOrganization` (pinned by `e2e/entity-graph.spec.ts`).
- **Titles:** a plain-string `title` never contains "Next Gen" (the layout template adds the brand); use `{ absolute }` for a branded title. ≤60 chars. Pinned by `e2e/invariant-title-brand.spec.ts`.
- `npm run lint`, `npx tsc --noEmit`, `npm run test:pure`, `npm run build` must pass before PR.
- JSON-LD should validate via `seo-sweep-state/tools/validate-jsonld.mjs`.

---

## Open

### P1
- [ ] (content, M) Frederick page: replace the draft coach POV in `src/data/frederick.ts` with Sam's voice once a Frederick season has real families in it (still no testimonials until a family agrees to one).
- [ ] (page, M) When a second out-of-county venue exists, give it an `EXTENDED_SERVICE_AREAS` row with a slug and a hand-rolled page modeled on `/youth-pickleball-frederick`.

### P2 — AEO depth
- [ ] (page, M) `/how-to-register` — `HowTo` schema, 5 steps (find session → register → checkout → confirmation email → arrive). Embed the same block on `/schedule`.
- [ ] (schema, S) `DefinedTerm` on home for "what is youth pickleball?" — definition + age range + link to `/levels`.
- [ ] (content, M) Expand home FAQ: "how is NGA different from rec league pickleball", "do you offer summer camps", "do you run school programs" (link `/schools`).
- [ ] (content, M) More answer-first posts: "is pickleball good exercise for kids", "what paddle should a kid use" (only claims sourced from site content).
- [ ] (technical, S) Consider per-route `lastModified` for evergreen pages (sammorrispb.com stats the page file's mtime) — only if it can be honest on Vercel builds.

---

## Done log

- 2026-09-13 — AEO audit PR: `/league` became the youth-leagues hub (running-now cards from season data, ItemList schema, planned league kept as an interest list); `/picklpark` retitled with "Frederick, MD"; new `/youth-pickleball-frederick` via slug-bearing `EXTENDED_SERVICE_AREAS`; one `#organization` entity with `orgRef()` everywhere; Facebook + GBP in `sameAs`; cost FAQ names season/camp prices (drop-in figure still forbidden); Frederick FAQ entries; double-brand titles fixed site-wide; sitemap `lastModified` only on blog posts; `/levels` Course schema + comparison table (`/tier-system` 301s there); `/leagues` 301; IndexNow weekly cron (ships dark); three answer-first blog posts.
- 2026-07/08 (pre-log) — `src/lib/seo.ts` helpers (breadcrumb, LocalBusiness, Course, areaServed); eight `/youth-pickleball-[city]` pages with hand-written POV, FAQPage, BreadcrumbList and LocalBusiness; `SportsEvent` per session on `/schedule` and home; Breadcrumb on the main pages; `sameAs` to sammorrispb.com + linkanddink.com; `/levels` page; `/blog` with four posts; llms.txt at `/llms.txt` and `/.well-known/llms.txt`.
