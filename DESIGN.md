---
name: Next Gen Pickleball Academy
description: Youth pickleball (ages 6-16, strict) in Montgomery County, MD. Dark-surface only. Navy + teal palette (2026-05-07 visual refresh, matches MCR pitch deck). Energetic for a 10-year-old, trustworthy for the parent writing the check.
version: alpha
colors:
  background: "#1A2744"
  background-deep: "#0E1830"
  surface: "#213056"
  surface-elevated: "#2C3E6E"
  logo-black: "#000000"
  primary: "#00B4D8"
  primary-bright: "#48CAE4"
  on-primary: "#1A2744"
  secondary: "#00D4FF"
  on-secondary: "#1A2744"
  tertiary: "#FF6B2B"
  on-tertiary: "#1A2744"
  accent-lime: "#AADC00"
  on-accent-lime: "#1A2744"
  on-background: "#EEF2FF"
  on-background-muted: "#8A99C5"
  success: "#00E676"
  on-success: "#1A2744"
  error: "#FF3B5C"
  on-error: "#1A2744"
  skill-red: "#FF4040"
  skill-orange: "#FF8C00"
  skill-green: "#00C853"
  skill-yellow: "#FFD600"
typography:
  hero:
    fontFamily: Montserrat
    fontSize: 3rem
    fontWeight: "800"
    lineHeight: 1.25
    letterSpacing: -0.02em
  h1:
    fontFamily: Montserrat
    fontSize: 2.25rem
    fontWeight: "800"
    lineHeight: 1.25
  h2:
    fontFamily: Montserrat
    fontSize: 1.875rem
    fontWeight: "700"
    lineHeight: 1.25
  h3:
    fontFamily: Montserrat
    fontSize: 1.5rem
    fontWeight: "700"
    lineHeight: 1.375
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: "400"
    lineHeight: 1.5
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: "400"
    lineHeight: 1.5
  label-caps:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: "600"
    lineHeight: 1.25
    letterSpacing: 0.08em
  numeric:
    fontFamily: Roboto Mono
    fontSize: 1rem
    fontWeight: "700"
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  full: 9999px
spacing:
  s-1: 4px
  s-2: 8px
  s-3: 12px
  s-4: 16px
  s-6: 24px
  s-8: 32px
  s-12: 48px
  s-16: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 0 24px
  button-primary-hover:
    backgroundColor: "{colors.primary-bright}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-background}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 0 24px
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-background}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    height: 48px
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    height: 48px
  card-program:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    rounded: "{rounded.lg}"
    padding: 16px
  card-coach:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    rounded: "{rounded.lg}"
    padding: 16px
  card-milestone:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-background}"
    rounded: "{rounded.lg}"
    padding: 16px
  badge-skill-red:
    backgroundColor: "{colors.skill-red}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  badge-skill-orange:
    backgroundColor: "{colors.skill-orange}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  badge-skill-green:
    backgroundColor: "{colors.skill-green}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  badge-skill-yellow:
    backgroundColor: "{colors.skill-yellow}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  badge-ease:
    backgroundColor: "{colors.accent-lime}"
    textColor: "{colors.on-accent-lime}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
    padding: 4px 12px
---

## Overview

Next Gen Pickleball Academy serves youth athletes ages 6–16 (strict — no
exceptions, no under-6 on-ramp) and their families. The brand is **The
Coach + The Guide**: energetic enough for a 10-year-old, trustworthy
enough for the parent writing the check. Never a retirement-sport vibe.
Never pure esports.

The product is mobile-first (96% of registration traffic comes from a
parent's phone) and dark-surface only — there's no light-mode counterpart.

**This file reflects the 2026-05-07 visual refresh:** navy ground with teal
as the primary brand mark, matching the MCR pitch deck. Lime is no longer
the brand primary; it now appears as the EASE accent and on `badge-ease`.
The skill-pathway palette (Red → Orange → Green → Yellow) is unchanged and
locked.

Core values (EASE) ladder into design quality: **E**thics → accessible
markup, **A**ttitude → clear affordances, **S**kills → reusable patterns,
**E**xcellence → consistent naming, no exceptions.

## Colors

The palette is layered: four navy grounds give the dark surface its depth,
two teal tones carry the brand mark, orange and lime act as warm/cool
accents, and four skill-pathway colors map directly to the
Red → Orange → Green → Yellow ball pathway. Skill labels never use synonyms
("Beginner," "Pro," "Expert" are banned — only the four ball colors).

- **`background` (#1A2744):** Primary page background. The whole product
  sits on this.
- **`background-deep` (#0E1830):** Deeper alternate ground — section
  alternation, hero overlays, occasional grounding.
- **`surface` (#213056):** Cards, default elevated surfaces.
- **`surface-elevated` (#2C3E6E):** Modals, popovers, secondary buttons —
  anything that needs to sit a layer above a card.
- **`primary` (#00B4D8 Brand Teal):** The current brand mark and primary
  CTA ground. Replaces the prior lime-as-primary system (2026-05-07
  refresh).
- **`primary-bright` (#48CAE4):** Hover state for primary; brighter teal
  highlights.
- **`secondary` (#00D4FF Cyan):** Secondary brand highlights, links,
  interactive accents.
- **`tertiary` (#FF6B2B Drive Orange):** Warm accent for moments that need
  warmth without being skill-color (e.g. "limited spots," urgency without
  alarm).
- **`accent-lime` (#AADC00):** Demoted from brand primary to **EASE
  accent**. Use on EASE badges, milestone moments, and the
  `shadow-glow-lime` celebration effect. Don't return it to chrome — the
  teal carries the brand now.
- **`on-background` (#EEF2FF):** Primary text. Not pure white — the slight
  cool tint sits better on navy.
- **`on-background-muted` (#8A99C5):** Captions, metadata, secondary text.
- **`skill-*`:** Red `#FF4040`, Orange `#FF8C00`, Green `#00C853`,
  Yellow `#FFD600`. Used as backgrounds for skill badges with navy text on
  top.

Logo black (`#000000`) and pure white (`#FFFFFF`) are **logo-asset colors
only** — they do not appear in UI components.

## Typography

Three families, locked. Don't substitute.

| Role | Family | Use |
|------|--------|-----|
| Headings, CTAs, nav | **Montserrat** (700/800) | All `h1`–`h4`, button labels, nav |
| Body, forms, prose | **Inter** (400/500/600) | Paragraphs, descriptions, forms |
| Numbers, prices, dates, scores | **Roboto Mono** (400/700) | Anything tabular or numeric |

- Body text minimum is `body-md` (1rem / 16px) on mobile.
- All-caps labels (`label-caps`) use `0.08em` tracking.
- Line height is never below 1.5 for body copy. Headings can tighten to
  1.25 (`hero`, `h1`, `h2`).

## Layout & Spacing

Mobile-first. iPhone SE (375px) is the minimum supported viewport.

- **Spacing base unit:** 4px. Token names map directly: `spacing.s-4` =
  16px.
- **Tap targets:** 48×48px minimum, 8px minimum between adjacent targets.
- **Thumb-zone rule:** Primary CTAs ("Get a Free Evaluation," "Register")
  live in the bottom 20% of the mobile viewport — the natural thumb reach.
  There's a fixed `StickyMobileCTA` for this.
- **Breakpoints:** 375 (sm) · 768 (md) · 1024 (lg) · 1280 (xl) · 1536
  (2xl). Grid is 4-col mobile, 8-col tablet, 12-col desktop.
- **Navigation:** mobile bottom nav max 5 items; desktop top nav max 7
  (Miller's Law). Any nav item under 15% click share at 90 days gets cut.

## Elevation & Depth

Depth is built from ground-up surface lightness, soft shadows, and
brand-toned glows reserved for moments.

- **Level 0 — page ground:** `background` (navy) or `background-deep`
  (alternate sections).
- **Level 1 — cards:** `surface` with `shadow-card`
  (`0 8px 32px rgba(0,0,0,0.45)`).
- **Level 2 — modals / floating:** `surface-elevated` with
  `shadow-card-lg` (`0 20px 60px rgba(0,0,0,0.55)`).
- **Brand glows (sanctioned, restrained):**
  - `shadow-glow-teal` (`0 0 32px rgba(0,180,216,0.25)`) on featured CTAs
    and hero moments — the brand-mark glow.
  - `shadow-glow-lime` (`0 0 24px rgba(170,220,0,0.18)`) on EASE
    moments — badge earned, milestone hit. **Lime glow is for celebration,
    not chrome.**

## Shapes

Rounded but not playful. The corner language is calm — this is a youth
academy, not a video game.

- `rounded.sm` (4px) — chips, tight inline
- `rounded.md` (8px) — buttons, inputs, default
- `rounded.lg` (12px) — cards
- `rounded.xl` (16px) — hero containers, large panels
- `rounded.xxl` (24px) — featured cards, hero callouts
- `rounded.full` — skill badges, avatars, pills

## Components

Naming law: every component class is `card`/`btn`/etc. base + a role
modifier (`btn-primary`, `card-program`). **Color-name classes are banned**
(`btn-teal`, `btn-lime`). Role only. Always.

### Buttons

- `button-primary` is the registration CTA. Teal ground, navy text. Hover
  flips to `primary-bright` (`#48CAE4`).
- `button-secondary` is for "View Schedule," "See the Pathway" —
  informational navigation that's not the headline action.
- `button-ghost` is the lowest hierarchy ("Learn More"). Transparent ground.
- `button-danger` is destructive ("Cancel Registration"). Red ground, navy
  text. Never use brand red as decorative — it's reserved for destructive
  intent.

### Cards

- `card-program` is the registration tile: skill badge + program name +
  ages + duration + price + Register CTA. Always wraps with
  `<article itemtype="https://schema.org/SportsEvent">` so schedulers and
  AI agents can parse it.
- `card-coach` is the coach profile mini: avatar + name + EASE-certified
  line.
- `card-milestone` is an EASE badge earned: icon + value
  (Ethics/Attitude/Skills/Excellence) + behavior earned.

### Badges

- `badge-skill-*` always uses the ball color as the ground and navy as the
  text (WCAG AA on every pairing). The label is always the literal color
  word ("Red Ball," "Yellow Ball"). Never substitute level synonyms.
- `badge-ease` uses lime + navy. This is the **only** chrome-level surface
  where lime appears — every other lime appearance is a glow or a moment
  of celebration. If lime is showing up in nav, buttons, or general UI,
  it's wrong.

## Do's and Don'ts

### Do
- Lead the page with the **Free Evaluation** CTA — that's the primary
  conversion across the entire site.
- Use `<time datetime="YYYY-MM-DD">` for every date and
  `itemprop="price" content="N"` for every price. Numeric, no `$` in the
  attribute. This is for AI/scheduler parsing.
- Tag programs with `data-age-min` and `data-age-max` so search and
  assistants can filter by age band.
- Mark up structured data with `schema.org/SportsEvent` for sessions and
  `schema.org/Person` for coaches.

### Don't
- Don't return lime to brand-primary or chrome positions. The 2026-05-07
  refresh moved lime to EASE-accent only; teal is the brand.
- Don't introduce parallel skill vocabulary ("Beginner," "Intermediate").
  The pathway is **only** Red → Orange → Green → Yellow.
- Don't use logo black or pure white as UI colors. Logo assets only.
- Don't drop body text below 1rem on mobile.
- Don't hide the primary CTA at the top of the mobile screen. Power zone
  is the bottom 20%.
- Don't replicate the NEXT GEN logo letterforms in UI headings. The
  condensed-italic style is logo-only; UI headings are Montserrat Bold.
- Don't add third-party analytics pixels (GA4, Meta Pixel, gtag, fbq).
  Funnel tracking is first-party only.
