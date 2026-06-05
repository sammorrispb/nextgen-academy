# BRAND_GUIDELINES.md — Next Gen Pickleball Academy
**Version:** 1.2 (palette refresh)
**Status:** Single Source of Truth
**Tagline:** Better than yesterday—together.

> **2026-05-07 visual refresh:** brand primary moved from lime to teal
> (#00B4D8) to match the MCR pitch deck. Lime (#AADC00) is now an EASE
> accent only — it no longer carries the brand. The full token table
> below reflects the live `src/app/globals.css`. See `DESIGN.md` at the
> repo root for the spec-compliant machine-readable mirror.

---

## STRATEGIC CONTEXT

**Who We Serve:** Athletes ages 6–16 and their families (strict — no exceptions, no under-6 on-ramp). Public group sessions are Green or Yellow Ball only; Red and Orange Ball players take private lessons until they bridge to group play. **Exception:** the recurring all-levels Tuesday ("Olney Tuesday Evening") runs a court per level (Red/Orange/Green/Yellow) and welcomes all four — Red/Orange families are invited there as a low-pressure group on-ramp, with private lessons still the primary recommendation.
**Primary User Flow:** 96% mobile-first registration by parents
**Secondary Audience:** AI assistants and scheduling bots parsing program data
**Brand Archetype:** The Coach + The Guide
**Design Principle:** Energetic enough for a 10-year-old. Trustworthy enough for
the parent writing the check. Never a retirement-sport vibe. Never pure esports.
**Core Values (EASE):** Ethics · Attitude · Skills · Excellence
**Skill Pathway:** Red → Orange → Green → Yellow

---

## LOGO SYSTEM

### Logo Specs
- **Mark:** NEXT GEN wordmark with pickleball replacing the "O" in NEXT
- **Wordmark color:** Pure White #FFFFFF (logo asset only — not used in UI text)
- **Pickleball accent:** Academy Lime #AADC00 (retained on the logo mark
  itself; lime as a UI color is now EASE-accent only)
- **Approved backgrounds:** Pure Black #000000 (primary), Court Navy #1A2744
  (secondary)
- **Never place on:** light backgrounds, busy photography, or any surface
  where white wordmark drops below 4.5:1 contrast ratio

### Logo Zone Rule
| Context | Background |
|---------|-----------|
| Logo lockup / hero | #000000 Pure Black |
| Site background | #1A2744 Court Navy |
| Cards / surfaces | #213056 Panel |
| Light background version | Does not exist yet — dark bg only |

### Logo Clear Space & Sizing
- Clear space: ½ of pickleball diameter on all four sides
- Minimum digital: 40px height
- Minimum print: 20mm height
- Pickleball element must never be cropped or separated from wordmark

### Typography Separation Rule
The condensed italic style in the NEXT GEN mark is logo-only.
Never replicate logo letterforms in UI components. All site headings use Montserrat Bold.

---

## COLOR SYSTEM

### Usage Rules
- Teal (`ngpa-teal` #00B4D8) is the brand primary. It carries the brand mark
  and grounds primary CTAs.
- Lime (`ngpa-lime` #AADC00) is DARK-SURFACE ONLY and scoped to EASE accents
  (badges, success moments, the `shadow-glow-lime` celebration effect). On
  white backgrounds contrast drops to 1.5:1; fails all WCAG levels. Never
  return lime to chrome (nav, buttons, large fills) — the 2026-05-07 refresh
  demoted it.
- Skill level colors map directly to the Red → Orange → Green → Yellow
  pathway. Use only these four labels. Never substitute synonyms (Beginner,
  Pro, Expert, etc.).
- Logo black (#000000) and logo white (#FFFFFF) are logo-asset colors only.
  Do not use them as general UI colors.

### Full Palette

WCAG contrast ratios below are computed against `ngpa-navy` (#1A2744) — the
primary page ground. Skill colors are typically used as ball-color
backgrounds with navy text on top (the inverse pairing); those badge
contrasts all clear AA.

| Role | Name | HEX | Tailwind Token | WCAG on Navy BG |
|------|------|-----|---------------|-----------------|
| Logo BG | Pure Black | #000000 | ngpa-black | — |
| Ground (deep alt) | Deep Navy | #0E1830 | ngpa-deep | — |
| Primary BG | Court Navy | #1A2744 | ngpa-navy | — |
| Surface | Panel | #213056 | ngpa-panel | — |
| Surface Elevated | Slate | #2C3E6E | ngpa-slate | — |
| **Brand Primary** | **Brand Teal** | **#00B4D8** | **ngpa-teal** | **5.9:1 ✅ AA** |
| Brand Hover / Bright | Teal Bright | #48CAE4 | ngpa-teal-bright | 7.7:1 ✅ AAA |
| Brand Secondary | Velocity Cyan | #00D4FF | ngpa-cyan | 7.4:1 ✅ AAA |
| EASE Accent | Academy Lime | #AADC00 | ngpa-lime | 9.4:1 ✅ AAA |
| Accent Warm | Drive Orange | #FF6B2B | ngpa-orange | 4.9:1 ✅ AA |
| Text Primary | Court White | #EEF2FF | ngpa-white | 16:1 ✅ AAA |
| Text Secondary | Muted Periwinkle | #8A99C5 | ngpa-muted | 4.5:1 ✅ AA |
| Success | EASE Green | #00E676 | ngpa-green | 9.0:1 ✅ AAA |
| Error / Alert | Out Ball Red | #FF3B5C | ngpa-red | 5.1:1 ✅ AA |
| Skill: Red Ball | Skill Red | #FF4040 | ngpa-skill-red | 4.7:1 ✅ AA |
| Skill: Orange Ball | Skill Orange | #FF8C00 | ngpa-skill-orange | 5.2:1 ✅ AA |
| Skill: Green Ball | Skill Green | #00C853 | ngpa-skill-green | 6.1:1 ✅ AA |
| Skill: Yellow Ball | Skill Yellow | #FFD600 | ngpa-skill-yellow | 5.9:1 ✅ AA |

### Tailwind v4 Configuration
The live tokens are exposed as Tailwind v4 utilities through the `@theme`
block in `src/app/globals.css`. The repo-root `DESIGN.md` is the
machine-readable mirror; its export at `design.theme.css` is `@import`-ed
from `globals.css`. Edit values in `globals.css` (`:root` block), and
update `DESIGN.md` + re-export when the palette changes.

```
--color-ngpa-black:        #000000;
--color-ngpa-deep:         #0E1830;
--color-ngpa-navy:         #1A2744;
--color-ngpa-panel:        #213056;
--color-ngpa-slate:        #2C3E6E;
--color-ngpa-teal:         #00B4D8;   /* brand primary */
--color-ngpa-teal-bright:  #48CAE4;
--color-ngpa-cyan:         #00D4FF;
--color-ngpa-lime:         #AADC00;   /* EASE accent only */
--color-ngpa-orange:       #FF6B2B;
--color-ngpa-white:        #EEF2FF;
--color-ngpa-muted:        #8A99C5;
--color-ngpa-green:        #00E676;
--color-ngpa-red:          #FF3B5C;
--color-ngpa-skill-red:    #FF4040;
--color-ngpa-skill-orange: #FF8C00;
--color-ngpa-skill-green:  #00C853;
--color-ngpa-skill-yellow: #FFD600;
```

---

## TYPOGRAPHY SYSTEM

### Font Stack (Locked)

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Headings | Montserrat | 700, 800 | H1–H4, CTAs, nav labels |
| Body | Inter | 400, 500, 600 | Paragraphs, descriptions, forms |
| Numbers / Stats | Roboto Mono | 400, 700 | Prices, scores, skill ratings, dates |

All three fonts load from Google Fonts.

### Type Scale
--text-xs:   0.75rem    /* 12px — badges, labels only */
--text-sm:   0.875rem   /* 14px — captions, metadata */
--text-base: 1rem       /* 16px — body minimum, never go below on mobile */
--text-lg:   1.125rem   /* 18px — lead paragraphs */
--text-xl:   1.25rem    /* 20px — card titles */
--text-2xl:  1.5rem     /* 24px — section headers */
--text-3xl:  1.875rem   /* 30px — page headers */
--text-4xl:  2.25rem    /* 36px — hero headlines */
--text-5xl:  3rem       /* 48px — splash / display */

### Line Heights (minimum 1.5 for all body copy)
--leading-tight:   1.25    /* Montserrat headlines only */
--leading-snug:    1.375   /* Subheadings */
--leading-normal:  1.5     /* Body minimum */
--leading-relaxed: 1.625   /* Newsletter, long descriptions */

### Letter Spacing
--tracking-hero:    -0.02em  /* Large Montserrat display */
--tracking-heading:  0em     /* Standard heads */
--tracking-body:     0.01em  /* Inter body on small screens */
--tracking-caps:     0.08em  /* ALL CAPS labels, nav items */

---

## COMPONENT NAMING CONVENTIONS

### Philosophy
Naming serves three audiences: parents using assistive tech, AI assistants parsing
schedules, and the dev team maintaining the codebase. EASE values map to code quality:
Ethics → accessible markup | Attitude → clear affordances |
Skills → reusable patterns | Excellence → consistent naming, no exceptions.

### Button System

Primary CTA — Registration:
<button type="button" class="btn btn-primary"
  aria-label="Register for [Program Name]"
  data-action="registration"
  data-program-id="[id]">
  Get a Free Evaluation
</button>

Secondary — Informational:
<button type="button" class="btn btn-secondary"
  aria-label="View program schedule">
  View Schedule
</button>

Ghost — Low hierarchy:
<button type="button" class="btn btn-ghost">Learn More</button>

Danger — Destructive:
<button type="button" class="btn btn-danger"
  aria-label="Cancel registration">
  Cancel Registration
</button>

Naming law: btn base class always present. Modifier always btn-[role].
Banned: color-name classes (btn-lime, btn-blue). Role only. Always.

### Card System

PROGRAM CARD:
<article class="card card-program"
  aria-label="[Program Name] for Ages [range]"
  itemscope itemtype="https://schema.org/SportsEvent">
  <header class="card__header">
    <span class="card__badge card__badge--skill-[color]"
      aria-label="Skill level: [Color] Ball">
      [Color] Ball
    </span>
    <h3 class="card__title" itemprop="name">[Program Name]</h3>
  </header>
  <div class="card__body">
    <p class="card__meta" itemprop="description">
      Ages [range] · [duration] · Small group ratios
    </p>
    <time class="card__date" itemprop="startDate" datetime="YYYY-MM-DD">
      Starts [Date]
    </time>
  </div>
  <footer class="card__footer">
    <span class="card__price" itemprop="price" content="[number]">$[price]</span>
    <button class="btn btn-primary"
      aria-label="Register for [Program Name]">Register</button>
  </footer>
</article>

COACH CARD:
<article class="card card-coach" aria-label="Coach profile: [Name]">
  <img class="card__avatar" src="..." alt="Coach [Name] on court" />
  <div class="card__body">
    <h3 class="card__title">[Name]</h3>
    <p class="card__meta">EASE Certified · [Specialty]</p>
  </div>
</article>

EASE BADGE / MILESTONE:
<article class="card card-milestone" aria-label="EASE Badge: [value]">
  <span class="card__icon" aria-hidden="true">[icon]</span>
  <h4 class="card__title">[Ethics|Attitude|Skills|Excellence]</h4>
  <p class="card__meta">[Behavior earned]</p>
</article>

TESTIMONIAL:
<blockquote class="card card-testimonial" cite="[source]">
  <p class="card__quote">"[Quote]"</p>
  <footer class="card__attribution">
    — [Parent Name], parent of [Athlete], [Level]
  </footer>
</blockquote>

Card naming law: card base + card-[content-type].
BEM inner elements: card__header, card__body, card__footer,
card__title, card__meta, card__badge, card__price, card__date, card__quote.

---

## MOBILE-FIRST LAYOUT RULES

### Thumb-Zone Safety Map
Phone reference: 375px wide (iPhone SE — minimum supported)

TOP 20%    ☠️  HARD REACH — Logo, page title only
20–40%     ⚠️  STRETCH ZONE — Secondary nav, filters
40–80%     ✅  NATURAL THUMB — Cards, primary content
BOTTOM 20% ✅  POWER ZONE — Primary CTAs always here

Bottom nav bar: always fixed, always visible, never hidden on primary flows.

### Thumb-Zone Rules
1. "Get a Free Evaluation" and "Register" CTAs must live in the Power Zone on mobile
2. Minimum tap target: 48×48px (WCAG 2.5.5)
3. Minimum spacing between adjacent tap targets: 8px
4. Fixed bottom navigation on mobile — no hamburger on primary registration flows
5. Never place primary CTA at top of mobile screen

### Navigation Constraints (Miller's Law — max 7)
Mobile Bottom Nav (max 5):
  [ Home ] [ Programs ] [ Schedule ] [ Coaches ] [ Account ]

Desktop Top Nav (max 7):
  [ Logo ] [ Programs ] [ Schedule ] [ Coaches ] [ About ] [ EASE ] [ Evaluate → ]

Analytics rule: Any nav item under 15% click share at 90 days gets cut.

### Breakpoints (mobile-first — build up)
--bp-sm:  375px    /* iPhone SE minimum */
--bp-md:  768px    /* Tablet portrait */
--bp-lg:  1024px   /* Tablet landscape */
--bp-xl:  1280px   /* Desktop */
--bp-2xl: 1536px   /* Large desktop */

### Grid
Mobile: 4-col | Tablet: 8-col | Desktop: 12-col

### Spacing (4px base unit — never go off-grid)
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-6:  24px
--space-8:  32px
--space-12: 48px
--space-16: 64px

---

## AI-PARSING OPTIMIZATION

1. All program dates: <time datetime="YYYY-MM-DD"> — never plain text only
2. All prices: itemprop="price" content="149" — numeric, no $ in attribute
3. Age ranges: data-age-min="5" data-age-max="16" on all program containers
4. Skill levels: use ONLY Red | Orange | Green | Yellow — never synonyms
5. EASE values always spelled in full when used as labels or metadata
6. Page title pattern: [Program Name] | Ages [range] | Next Gen Pickleball Academy
7. Programs use schema.org/SportsEvent structured data minimum

---

## DESIGN TOKENS — FULL REFERENCE

:root {
  /* Backgrounds */
  --color-bg-logo:       #000000;
  --color-bg-deep:       #0E1830;
  --color-bg-primary:    #1A2744;
  --color-bg-surface:    #213056;
  --color-bg-elevated:   #2C3E6E;

  /* Brand */
  --color-brand-primary: #00B4D8;   /* teal — brand mark, primary CTA ground */
  --color-brand-bright:  #48CAE4;
  --color-brand-soft:    rgba(0, 180, 216, 0.12);
  --color-accent:        #FF6B2B;
  --color-accent-lime:   #AADC00;   /* EASE accent only */

  /* Text */
  --color-text-logo:     #FFFFFF;
  --color-text-primary:  #EEF2FF;
  --color-text-muted:    #8A99C5;

  /* Semantic */
  --color-success:       #00E676;
  --color-error:         #FF3B5C;

  /* Skill pathway (locked — never substitute) */
  --color-skill-red:     #FF4040;
  --color-skill-orange:  #FF8C00;
  --color-skill-green:   #00C853;
  --color-skill-yellow:  #FFD600;

  /* Typography */
  --font-heading: 'Montserrat', system-ui, sans-serif;
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    'Roboto Mono', monospace;

  /* Border Radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card:       0 8px 32px rgba(0, 0, 0, 0.45);
  --shadow-card-lg:    0 20px 60px rgba(0, 0, 0, 0.55);
  --shadow-glow-teal:  0 0 32px rgba(0, 180, 216, 0.25);  /* brand mark glow */
  --shadow-glow-lime:  0 0 24px rgba(170, 220, 0, 0.18);  /* EASE celebration */
}

---

## COPYWRITING GUARDRAILS

Words we use: pathway, progress, reps, cues, EASE, triangle, community,
better than yesterday, evaluate, growth, family, next gen

Words we ban: hype without proof, sarcasm, insider slang, jargon

Tone — Kids: playful, clear, actionable
Tone — Parents: reassuring, transparent, progress-oriented
Tone — Partners: turnkey, credentialed, outcome-focused

Primary CTA (always): Get a Free Evaluation
Secondary CTAs: View Schedule · See the Pathway · Meet the Coaches

---

## COMMS TEMPLATES (Email + SMS)

Single source of truth for every transactional message NGA sends — booking
confirmation, 24h reminder, session-cancel broadcast, post-session "book the
next one," cancellation confirmation. Every body string passes
`/brand-review-nga` before merge.

### Signature standard
- Email signoff: `Coach Sam · Next Gen Pickleball Academy` (or `Coach Amine`
  when sent from Amine). Never plain "Sam" or "Sam Morris—Head Coach."
- One line above the signature carries the tagline or an EASE nod, e.g.
  `See you on the court — better than yesterday, together.`
- SMS signoff: `— Coach Sam · NGA · Reply STOP to opt out.` (TCPA STOP
  language is non-negotiable; the human signature comes first.)

### EASE laddering per template type
Each email carries one EASE value. Pick the value that matches the moment:
- Booking confirmation → **Excellence** (preparedness — .ics, what to bring)
- 24h reminder → **Attitude** (showing up ready, growth mindset)
- Session-cancel broadcast → **Ethics** (fair play, integrity in the swap)
- Post-session re-book → **Skills** (purposeful progress, what they worked on)
- Cancellation confirmation → **Community** ("seat is open for another player")

### Voice rules
- Lead with the helpful action. Hide the no-refund / restriction clause
  behind it ("If something comes up, cancel your reservation so the next
  player can grab the seat. Drop-ins are non-refundable, but the swap helps
  the whole community.").
- Parent-facing register: reassuring, transparent, progress-oriented.
- SMS opens with the kid's name, not "NGA:" or any system prefix.

### CTA hierarchy
- One primary CTA per email. Maps gets the arrow `→`. Everything else
  (cancel link, "View session details," support tel:) is utility — no arrow,
  no chip styling.
- Self-serve cancel is utility, not a CTA. Phrase as inline action
  ("cancel your reservation"), not a button.

### Plain-text fallback parity
Every HTML email ships with a plain-text body. The fallback MUST include:
- Maps URL (mirror the HTML's directions link)
- Cancel URL if `cancelUrl` is set
- The same Coach Sam signoff + tagline line
- A scannable "What to bring" list, not a comma-joined sentence

### Delivery / headers
- `from`: `Next Gen PB Academy <noreply@nextgenpbacademy.com>`
- `replyTo`: `nextgenacademypb@gmail.com`
- Parent-facing transactional sends: **BCC** `nextgenacademypb@gmail.com`
  (privacy — never CC, never expose other parents' emails).
- Lead-form auto-replies follow LD-style CC rules — that's a different rule
  set; see `/api/lead`.

### SMS — when and what
- SMS only fires when `smsConsent === true` on the row. `sendSms()` refuses
  to send without consent (TCPA).
- Three approved transactional SMS types: booking confirmation, 24h
  reminder, session-cancellation broadcast. The post-session re-book email
  has **no** SMS counterpart — that would be promotional and requires a
  separate marketing opt-in.
- Body budget: 1 segment when possible (≤ 160 GSM-7 chars). The Coach Sam
  signoff line is part of the budget, not optional.

### Community-channel invites (WhatsApp, SMS broadcast, Geneva, etc.)
These are utility, not CTAs. The host email already owns one primary CTA
(arrow + chip) — a community invite must not compete with it.

- **Discoverability:** never publish the invite URL on the public website
  (no footer, no landing page, no `/contact`). Invites travel only inside
  parent-facing transactional or first-touch emails.
- **Gating:** first-touch only. Send once per parent across all NGA email
  surfaces. Re-prompting returning families erodes the "earned, not
  scraped" signal. The `isFirstTimeParent(contact)` helper in
  `src/lib/notion-player-lookup.ts` is the canonical gate.
- **Visual weight:** render as a quiet utility block (`s.card`, muted
  label), not an action callout (`s.actionCallout` / `s.cardAccent` are
  reserved for the host email's primary CTA).
- **CTA hierarchy:** the invite link is inline, no `→` arrow, no chip
  styling. The arrow rule (Maps gets the arrow, everything else is
  utility) applies edge-to-edge — a second arrow in the same email is a
  hierarchy break.
- **Privacy:** invite links create cross-parent exposure once joined.
  Mention it plainly in the copy ("other Next Gen parents") so the
  recipient knows the room is shared. Never list other parents by name.
- **Copy register:** anchor "you," prefer "Next Gen parents" over "NGA
  parents" in cold sends (the abbreviation isn't yet earned), and echo
  the "together" half of the tagline when it lands naturally.

### Idempotency on Notion drop-in rows
Crons write a boolean to the drop-in row after a successful send:
- `Reminder Sent` — 24h reminder cron
- `Post Session Sent` — post-session re-book cron
- `Cancellation Notified` — cancellation-confirmation send

Crons skip rows where the corresponding flag is already true. Add new
columns via `mcp__claude_ai_Notion__update-data-source` BEFORE the code that
writes to them lands.

---

*Single source of truth. All Tailwind configs, component libraries, Claude Code
prompts, and Canva templates reference this file first.*
*Machine-readable mirror: see `DESIGN.md` at the repo root
(spec: github.com/google-labs-code/design.md). Re-export with
`bun run src/index.ts export --format css-tailwind` from
~/Projects/design.md/packages/cli when DESIGN.md changes.*
*Update trigger: logo source HEX confirmed, or palette change approved by Sam & Amine.*
