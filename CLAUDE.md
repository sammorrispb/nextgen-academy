# Next Gen Pickleball Academy — Website

## What This Is
Marketing website for Next Gen Pickleball Academy — a lead-gen tool for families with kids ages 5-16 in Montgomery County, MD. Drives parents toward free evaluations and CourtReserve session registration.

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
