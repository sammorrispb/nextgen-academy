# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is
Marketing / lead-gen website for **Next Gen Pickleball Academy** — youth pickleball (ages 5–16) in Montgomery County, MD. Drives parents to free evaluations, CourtReserve registration, and the Yellow Ball tournament track.

Live at https://nextgenpbacademy.com (deployed on Vercel, auto-deploy from `main`).

## Ecosystem
Part of Sam Morris's pickleball platform. Other repos this site talks to:
- **The Hub** (`sammorrispb/The-Hub`) at linkanddink.com — receives unified-funnel events (`/api/funnel-event`) and `inbound_leads` rows for Meta-ad attribution.
- **Open Brain** (`sammorrispb/open-brain`) — semantic CRM; receives `ingestToOpenBrain` POSTs.
- Cross-family nav links use `familySiteUrl()` helpers that stamp UTMs + `ld_pid`.

## Stack
- **Next.js 16** (App Router, TypeScript, React 19, Turbopack)
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Fonts:** Montserrat (headings), Inter (body), Roboto Mono (numbers/dates) — loaded via `next/font/google` in `src/app/layout.tsx`
- **Email:** Resend (`resend` SDK)
- **Tests:** Playwright (`@playwright/test`) — desktop + mobile projects
- **Path alias:** `@/*` → `src/*`

## Common Commands
```bash
npm run dev       # local dev server (http://localhost:3000)
npm run build     # production build — must pass with zero errors before push
npm run lint      # ESLint (eslint-config-next + core-web-vitals + typescript)
npm start         # serve the production build

# Playwright (no npm script — run directly)
npx playwright test                          # all e2e tests, both projects
npx playwright test --project=desktop        # desktop only (1280×800)
npx playwright test --project=mobile         # mobile only (375×812)
npx playwright test e2e/homepage.spec.ts -g "FAQ"   # single test by name
# baseURL is http://localhost:3000 — start `npm run dev` in another terminal first

# Funnel wiring sanity check (validates HMAC signing + ensures no analytics
# pixels / Yellow Ball mailto: links / urls.ts regressions crept back in)
node scripts/verify-funnel.mjs
```

## Architecture

### Pages (App Router)
All pages render against the dark theme set in `layout.tsx` (`bg-ngpa-navy`).

- `/` (`src/app/page.tsx`) — Home. Single long page with anchor sections: `#levels`, `#ease`, `#testimonials`, `#about`, `#contact-form`, `#faq`, `#contact`. Old top-level routes (`/programs`, `/about`, `/contact`, `/faq`) are 301-redirected to anchors via `next.config.ts`.
- `/schedule` — Live from CourtReserve via ISR (`export const revalidate = 300`). Falls back to widget links if CR credentials missing or fetch fails.
- `/free-evaluation` — Dedicated lead-gen landing page (was `/free-trial`, redirected).
- `/yellowball/inquiry` — Separate inquiry form for the tournament track (Yellow Ball is invite-only — no public registration).
- `/montgomery-county-youth-pickleball` — SEO landing page targeting local search.

### Content vs. Live Data
- **Static content** lives in `src/data/*.ts` and is the single source of truth: `levels.ts`, `coaches.ts`, `faq.ts`, `testimonials.ts`, `locations.ts`, `site.ts`, `seo.ts`, `ease.ts`, `blocks.ts` (cohort roster), `block-emails.ts`, `schedule.ts`.
- **Live data** comes from CourtReserve (`src/lib/courtreserve.ts`) — only the schedule page and the free-trial RSVP form fetch live events.

### CourtReserve integration (`src/lib/courtreserve.ts` + `src/lib/schedule-transform.ts`)
- Two locations are hard-coded: Rockville (orgId 10869) and North Bethesda (orgId 10483).
- `fetchNextGenEvents()` calls `https://api.courtreserve.com/api/v1/eventcalendar/eventlist` with Basic auth. Per-location credentials in env: `COURTRESERVE_{ROCKVILLE,NORTHBETHESDA}_{USERNAME,PASSWORD,ORG_ID}`.
- Filters events by `EventCategoryName` matching `/Next Gen|Kids Program/i`, drops cancelled.
- `transformEvents()` parses ball level from event name (`/(red|orange|green)/i`), groups sessions by `dayOfWeek + timeRange`, sorts, computes `spotsRemaining`.
- Defensive about CR's response shape: handles both `{ Data: [...] }` and raw arrays. 10s timeout via `AbortController`. Schedule page uses `Promise.allSettled` so one location failing doesn't blank the page.

### Lead flow (`/api/lead`, `/api/yellowball-lead`, `/api/free-trial`)
A single lead submission fans out to multiple destinations. Order in `src/app/api/lead/route.ts`:
1. **Rate limit** by IP (in-memory map, 5 req/hr — resets on deploy).
2. **Validate** with `src/lib/validate-lead.ts` (or `validate-free-trial.ts`).
3. **Notion CRM** dedup-and-create (`NOTION_DB_ID = "1e5e34c258384c6cb5f3e846543ecfc7"`). Skipped if `NOTION_API_KEY` missing.
4. **Resend** emails: admin notification to `sam.morris2131@gmail.com` (cc `nextgenacademypb@gmail.com`) + parent confirmation if email provided.
5. **Open Brain** ingest (`ingestToOpenBrain`, fire-and-forget, requires email — phone-only leads are skipped here and backfilled later).
6. **Unified funnel** event to the Hub (`sendFunnelEvent` → `linkanddink.com/api/funnel-event`).
7. **Hub `inbound_leads`** direct insert via Supabase REST (used for Meta-ad conversion tracking).

If any optional integration's env var is missing, that step logs a warning and is skipped — the response still succeeds as long as Resend works.

### Unified funnel (`src/lib/funnelClient.ts` + `funnelServer.ts` + `funnelSign.ts`)
- Visitor identity: `ld_visitor` cookie (1y, SameSite=Lax) set by `getOrCreateVisitorId()`. Read by `familySiteUrl()` to stamp `ld_pid` on cross-site links.
- Client events POST to `/api/funnel-track` (proxy) which signs with `FUNNEL_INGEST_SECRET_NGA` and forwards to the Hub. Signature format is `v1:<ms>:<site_id>:<event_type>:<visitor_id>:<email>:<marketing_ref>` HMAC-SHA256 — must stay byte-identical to the Hub's verifier. `scripts/verify-funnel.mjs` snapshots this.
- `site_id` is always `"nga"`. `marketing_ref` defaults to `"nga"` and is upgraded by `getRefSource()` in `src/lib/urls.ts` (e.g. `/yellowball` → `"nga_yellowball"`).
- **No third-party pixels.** GA4, Meta Pixel, `@vercel/analytics`, `gtag`, `fbq` are explicitly banned — `verify-funnel.mjs` greps for them.

### Cron: block re-register reminders (`/api/cron/block-reminders`)
- Triggered by Vercel Cron (`vercel.json` → `0 14 * * *` daily 14:00 UTC). Auth: `Authorization: Bearer ${CRON_SECRET}`.
- Iterates `blocks` in `src/data/blocks.ts`. A "block" = 4-week cohort at a specific day/time/location with a `participants[]` roster.
- `blocksNeedingReminder()` finds blocks past `REMINDER_THRESHOLD = 0.7` (~3/4 done) whose id isn't in `remindersSent[]`.
- Sends per-participant emails via `renderBlockReminderEmail()` and a summary to admin.
- **Dedup is by hand-edit:** the cron does NOT write back to `blocks.ts` — Sam manually appends to `remindersSent[]` and commits, keeping the audit trail in git.

### URL helpers (`src/lib/urls.ts`)
Always route outbound links through these — they handle UTM/`ref` stamping consistently:
- `hubUrl(path, extraParams?, ref?)` → linkanddink.com with `ref=nga` default.
- `crUrl(target, ref?)` → adds `utm_source=nga` to a CourtReserve URL.
- `familySiteUrl(dest, path)` → cross-family link with full UTM block + `ld_pid` cookie value.
- `getRefSource(pathname)` → maps page paths to specific `marketing_ref` values.

## Conventions
- **Theme is dark, not light.** Backgrounds alternate `bg-ngpa-navy` and `bg-ngpa-black`; cards use `bg-ngpa-panel` / `bg-ngpa-slate`. The brand colors (`ngpa-lime #AADC00`, `ngpa-cyan`, etc.) are dark-surface only — `ngpa-lime` on white fails WCAG. See `BRAND_GUIDELINES.md` for the full palette and rules.
- **Skill colors are `ngpa-skill-{red,orange,green,yellow}`** (`#FF4040`, `#FF8C00`, `#00C853`, `#FFD600`). Always use Red / Orange / Green / Yellow as labels — never synonyms like "Beginner" / "Pro".
- **Tailwind utilities only**, no inline styles. Mobile-first; iPhone SE (375px) is the minimum supported viewport.
- **Min tap target 48×48px** (WCAG 2.5.5). Primary CTAs ("Get a Free Evaluation", "Register") belong in the bottom thumb zone — there's a fixed `StickyMobileCTA` for mobile.
- **Schema.org JSON-LD** is required: `SportsActivityLocation` in the root layout, `FAQPage` + `Person` (per coach) on the home page, one `SportsEvent` per upcoming session on `/schedule`. Use the `<JsonLd />` component.
- **All program dates use `<time datetime="YYYY-MM-DD">`** and prices use `itemprop="price" content="N"` (numeric, no `$`). This is for AI/scheduler parsing — see BRAND_GUIDELINES "AI-PARSING OPTIMIZATION".
- **Yellow Ball is invite-only.** No public registration link, no `mailto:` CTAs — route all interest to `/yellowball/inquiry`. `verify-funnel.mjs` enforces this.
- Don't add comments that describe what code does. Add a comment only when the *why* isn't obvious (e.g. the CR API shape unwrap, the `remindersSent[]` git-as-audit-trail decision).

## Environment Variables
See `.env.example`. Categories:
- `RESEND_API_KEY` — required for any lead form to succeed.
- `NOTION_API_KEY` — optional; if absent Notion step is skipped.
- `OPEN_BRAIN_INGEST_URL` + `LEAD_INGEST_TOKEN` — Open Brain ingest.
- `HUB_SUPABASE_URL` + `HUB_SERVICE_ROLE_KEY` — direct Hub `inbound_leads` insert.
- `FUNNEL_INGEST_SECRET_NGA` — HMAC secret; **must match The-Hub's value of the same name**.
- `COURTRESERVE_{ROCKVILLE,NORTHBETHESDA}_{USERNAME,PASSWORD,ORG_ID}` — schedule page returns the fallback widget UI if these are absent.
- `CRON_SECRET` — Vercel Cron auth for `/api/cron/block-reminders`.

## Testing Standards
- **`npm run build` must pass with zero errors before every push.** Minimum bar.
- Test behaviour, not implementation — Playwright specs in `e2e/` assert what the page renders / what the API returns.
- Tag mobile-only / desktop-only tests by checking `testInfo.project.name` and calling `test.skip()` (see `homepage.spec.ts`).
- **CR API integration**: handle timeout, empty response, and malformed shapes gracefully — the schedule page must never blank out on a CR failure (use the widget fallback UI).
- Validate any form input (XSS / injection) before persisting or echoing back.

## Reference Files
- `BRAND_GUIDELINES.md` — single source of truth for colors, typography, component naming (BEM `card__title` etc.), thumb-zone rules, copywriting do/don't lists. Read this before any visual change.
- `docs/spring-2026-emails.md` — current email-campaign templates with merge fields.
