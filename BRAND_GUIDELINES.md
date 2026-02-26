# BRAND_GUIDELINES.md — Next Gen Pickleball Academy
**Version:** 1.1
**Status:** Single Source of Truth
**Tagline:** Better than yesterday—together.

---

## STRATEGIC CONTEXT

**Who We Serve:** Athletes ages 5–16 and their families
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
- **Pickleball accent:** Academy Lime #AADC00
- **Approved backgrounds:** Pure Black #000000 (primary), Court Navy #05132B (secondary)
- **Never place on:** light backgrounds, busy photography, or any surface where white
  wordmark drops below 4.5:1 contrast ratio

### Logo Zone Rule
| Context | Background |
|---------|-----------|
| Logo lockup / hero | #000000 Pure Black |
| Site background | #05132B Court Navy |
| Cards / surfaces | #0C1F47 Deep Panel |
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
- ngpa-lime is DARK-SURFACE ONLY. On white backgrounds contrast drops to 1.5:1 —
  fails all WCAG levels. Never use on light surfaces.
- Skill level colors map directly to the Red → Orange → Green → Yellow pathway.
  Use only these four labels. Never substitute synonyms (Beginner, Pro, Expert, etc.)
- Logo black (#000000) and logo white (#FFFFFF) are logo-asset colors only.
  Do not use them as general UI colors.

### Full Palette

| Role | Name | HEX | Tailwind Token | WCAG on Navy BG |
|------|------|-----|---------------|-----------------|
| Logo BG | Pure Black | #000000 | ngpa-black | — |
| Primary BG | Court Navy | #05132B | ngpa-navy | — |
| Surface | Deep Panel | #0C1F47 | ngpa-panel | — |
| Surface Elevated | Slate Court | #1A3060 | ngpa-slate | — |
| Brand Primary | Academy Lime | #AADC00 | ngpa-lime | 6.8:1 ✅ AA |
| Brand Secondary | Velocity Cyan | #00D4FF | ngpa-cyan | 5.8:1 ✅ AA |
| Accent Warm | Drive Orange | #FF6B2B | ngpa-orange | 4.6:1 ✅ AA |
| Text Primary | Court White | #EEF2FF | ngpa-white | 16:1 ✅ AAA |
| Text Secondary | Muted Periwinkle | #7A88B8 | ngpa-muted | 4.6:1 ✅ AA |
| Success / Progress | EASE Green | #00E676 | ngpa-green | 8.9:1 ✅ AAA |
| Error / Alert | Out Ball Red | #FF3B5C | ngpa-red | 5.1:1 ✅ AA |
| Skill: Red Ball | Skill Red | #FF4040 | ngpa-skill-red | 4.7:1 ✅ AA |
| Skill: Orange Ball | Skill Orange | #FF8C00 | ngpa-skill-orange | 5.2:1 ✅ AA |
| Skill: Green Ball | Skill Green | #00C853 | ngpa-skill-green | 6.1:1 ✅ AA |
| Skill: Yellow Ball | Skill Yellow | #FFD600 | ngpa-skill-yellow | 5.9:1 ✅ AA |

### Tailwind Configuration
Add to tailwind.config.js under theme.extend.colors:

'ngpa-black':        '#000000',
'ngpa-navy':         '#05132B',
'ngpa-panel':        '#0C1F47',
'ngpa-slate':        '#1A3060',
'ngpa-lime':         '#AADC00',
'ngpa-cyan':         '#00D4FF',
'ngpa-orange':       '#FF6B2B',
'ngpa-white':        '#EEF2FF',
'ngpa-muted':        '#7A88B8',
'ngpa-green':        '#00E676',
'ngpa-red':          '#FF3B5C',
'ngpa-skill-red':    '#FF4040',
'ngpa-skill-orange': '#FF8C00',
'ngpa-skill-green':  '#00C853',
'ngpa-skill-yellow': '#FFD600',

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
  --color-bg-primary:    #05132B;
  --color-bg-surface:    #0C1F47;
  --color-bg-elevated:   #1A3060;

  /* Brand */
  --color-brand-primary: #AADC00;
  --color-brand-second:  #00D4FF;
  --color-accent:        #FF6B2B;

  /* Text */
  --color-text-logo:     #FFFFFF;
  --color-text-primary:  #EEF2FF;
  --color-text-muted:    #7A88B8;

  /* Semantic */
  --color-success:       #00E676;
  --color-error:         #FF3B5C;

  /* Skill pathway */
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
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card:       0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-glow-lime:  0 0 20px rgba(170, 220, 0, 0.15);
  --shadow-glow-cyan:  0 0 20px rgba(0, 212, 255, 0.12);
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

*Single source of truth. All Tailwind configs, component libraries, Claude Code
prompts, and Canva templates reference this file first.*
*Update trigger: logo source HEX confirmed, or palette change approved by Sam & Amine.*
