# Next Gen Pickleball Academy — Website

## Brand
NGA has its own brand guide — not LD's. Review all copy against these before shipping:
- `docs/brand-guide.md` — Part 1: design system (Pathway Rainbow palette, Montserrat/Inter, logo, imagery)
- `docs/brand-guide-part2.md` — Part 2: positioning, voice (Coach register, parent-aware), EASE values, ball-color pathway, Parent–Coach–Kid Triangle

**Key divergences from LD:** "Free evaluation" is an approved CTA (NGA's main conversion lever). Always CC `nextgenacademypb@gmail.com`. Sign emails as "Coach Sam" and "Coach Amine" (co-founders). Tagline is "Better than yesterday—together." (NOT "Play up.").

Use `/brand-review-nga` to audit copy against the NGA guide. `/brand-review` (no suffix) is LD-only.

## What This Is
Marketing website for Next Gen Pickleball Academy — a lead-gen tool for families with kids ages 5-16 in Montgomery County, MD. Drives parents toward free evaluations and CourtReserve session registration.

## Ecosystem
Part of Sam Morris's pickleball platform ecosystem. See also:
- **The Hub** (`sammorrispb/The-Hub`) — Core community platform at linkanddink.com
- **Open Brain** (`sammorrispb/open-brain`) — Semantic knowledge + MCP server (handles Next Gen attendance sync via `nextgen-sync` Edge Function)
- **Sam Morris Website** (`sammorrispb/sam-morris-website`) — Personal coaching site
- **CourtReserve Ops** (`sammorrispb/courtreserve-ops`) — DD operations plugin

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4
- Fonts: Montserrat (headings), Inter (body) via next/font/google
- Content: Mostly in src/data/*.ts; schedule page pulls live data from CourtReserve API
- Deploy: Vercel (ISR for schedule page, static for all others, auto-deploy from GitHub)

## Conventions
- Tailwind utility classes (NOT inline styles)
- Mobile-first responsive design
- Light/clean theme: white + gray-50 alternating sections
- Ball-system color accents: Red #DC2626, Orange #EA580C, Green #16A34A, Yellow #CA8A04
- Static content lives in src/data/*.ts — single source of truth
- Schedule page fetches live events from CourtReserve API (src/lib/courtreserve.ts)
- CourtReserve credentials in env vars: COURTRESERVE_{ROCKVILLE,NORTHBETHESDA}_{USERNAME,PASSWORD,ORG_ID}
- Components in src/components/
- Pages in src/app/ using App Router

## Pages
1. Home `/` — Hero, EASE values, programs overview, CTA
2. Programs `/programs` — Expanded level cards, pricing, Yellow Ball CTA
3. Schedule `/schedule` — Live from CourtReserve (ISR 5min), grouped by location/time slot, expandable dates with spots remaining
4. About `/about` — Founders' story, coach cards, teaching philosophy
5. Contact `/contact` — Email/phone/Instagram, evaluation info, location maps

## Build & Dev
- `npm run dev` — local dev server
- `npm run build` — production build (must pass with no errors)
- Schedule page uses ISR (revalidate every 5min) with CourtReserve API; all other pages static

## Testing Standards
- **Test behavior, not implementation** — validate what the page renders and what the API returns, not internal function calls
- **Build must pass**: `npm run build` with zero errors before every push — this is the minimum bar
- **CR API integration**: Test that schedule page handles CR API failures gracefully (timeout, empty response, malformed data)
- **Mobile-first**: Visually verify all pages on mobile viewport before shipping layout changes
- **Security**: Validate any form inputs (contact form, evaluation requests) against XSS and injection
