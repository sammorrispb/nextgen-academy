# Next Gen Pickleball Academy — Brand Guide, Part 1: Design System

> Companion to `docs/brand-guide-part2.md` (Positioning, Voice & Story).
> Last updated 2026-04-18 (v1.1).

NGA's own design system. Distinct from Link & Dink's (which lives in `~/The-Hub/docs/brand-guide.md`). The bridge between brands is the shared ecosystem, not a shared identity.

---

## 1. Logo System

**Working spec until final lockups ship.** The Notion guide labels these "working specs" — treat any logo usage as provisional and subject to change.

### Variants to build

| Variant | Use case | Status |
|---|---|---|
| Primary wordmark | Website header, flyers, business cards | 🟡 In use (working) |
| Icon mark | Favicon, social avatar, app icon | 🟡 In use (working) |
| Stacked lockup | Social posts, t-shirts | ⬜ Not built |
| One-color (light bg) | Print, partner collateral | ⬜ Not built |
| One-color (dark bg) | Video overlays, dark-mode UI | ⬜ Not built |

### Clear space
½ of logo width on all sides.

### Minimum sizes
- Digital: 40 px height
- Print: 20 mm height

### What NOT to do
- Don't stretch / skew
- Don't recolor outside the Pathway Rainbow palette
- Don't place over busy photography without a solid backplate
- Don't combine with another brand mark within ½ logo-width

---

## 2. Color Palette — Pathway Rainbow

The pathway IS the brand. Every piece of collateral can signal "which level are we talking about?" at a glance. The four ball colors are the brand spectrum; navy anchors as the neutral.

### Primary — Pathway spectrum

These match the hex values used in the site's Tailwind config (per `CLAUDE.md` §Conventions). Do not drift from these without updating both the guide and the code together.

| Level | Token | Hex | Tailwind equivalent | Usage |
|---|---|---|---|---|
| 🔴 Red | `--nga-red` | `#DC2626` | `red-600` | Level 1 — Discovery. Accents on beginner/Red-band pages, icons, badges. |
| 🟠 Orange | `--nga-orange` | `#EA580C` | `orange-600` | Level 2 — Foundation. Accents on Orange-band pages, intermediate CTAs. |
| 🟢 Green | `--nga-green` | `#16A34A` | `green-600` | Level 3 — Development. Accents on Green-band pages, progress indicators. |
| 🟡 Yellow | `--nga-yellow` | `#CA8A04` | `yellow-600` | Level 4 — Competition. Accents on Yellow-band pages, tournament prep, highest-level CTAs. |

### Anchor neutrals

| Role | Token | Hex | Usage |
|---|---|---|---|
| Ink (body / headings) | `--nga-ink` | `#1F2937` | gray-800 — default text color, headings, navigation |
| Surface | `--nga-surface` | `#FFFFFF` | Primary page background |
| Alt surface | `--nga-surface-alt` | `#F9FAFB` | gray-50 — alternating section backgrounds |
| Border | `--nga-border` | `#E5E7EB` | gray-200 — dividers, card edges |

### Usage rules

- **Pathway colors are accents, never full backgrounds** for body copy (contrast fails, and they're meant to signal LEVEL not THEME).
- **Never place two pathway colors adjacent at equal weight** — pick one dominant (current level) with muted Ink support. The rainbow lives across the whole site; at a surface level, one color leads.
- **Yellow (`#CA8A04`) reads amber on screen**; use it for the Competition tier only. Don't treat it as a "caution/warning" signal.
- **Red is a skill level, not an error color.** For form errors/alerts, use `#B91C1C` (red-700) or borrow from a standard UI kit — keep the pathway red pure.

### Do not use
- Neon pink / teal / purple — these are not in the NGA spectrum.
- LD's spruce green (`#14543A`) or lime accent — that's the LD ecosystem, not NGA.

---

## 3. Typography

Matches `next/font/google` config in the site.

| Role | Family | Weight | Usage |
|---|---|---|---|
| Headings | **Montserrat** | 700 (Bold) | Hero headlines, section titles, CTAs |
| Body | **Inter** | 400 / 500 | Paragraph text, UI labels |
| Numbers / Stats | Roboto Mono | 500 | Scores, session counts, ages, prices (where emphasis helps) |

### Sizing guidelines

- Hero headline: 48–64px desktop / 32–40px mobile
- Section title: 32px / 24px
- Body: 16px minimum
- Small print (disclaimers, age ranges): 14px minimum — never go smaller, parents squint

### Don'ts
- No all-caps body copy (headings only)
- No italic body — reserve italic for quotes or emphasis
- No mixing serif fonts — Montserrat + Inter only

---

## 4. Imagery

### What to show
- Bright, candid action on court — kids in mid-rally, not posed
- Mixed ages and families — siblings, parents with kids, cross-generational play
- Bonding moments — post-point high-fives, parent-coach chats, sideline snacks
- Success + joy — celebration after a point, a kid's focused face, a parent's genuine smile
- Home/family play — pickleball in the driveway, paddle drills on the living room floor

### What to avoid
- Stock photography with obvious "stock" feel (generic smiles, clean studio lighting, no sweat)
- Adult-only pickleball images (that's LD's territory)
- Kids posed with trophies unless it's real (authenticity > aspirational)
- Branded outside-gear dominating the frame (we're not selling paddles)

### Release forms
- **Required** for any recognizable kid image used publicly.
- Stored in Notion under the family's record.
- Revoke path documented — if a family withdraws consent, image comes down within 48h.

---

## 5. Component Patterns

Matches `src/components/` conventions in the Next.js site.

### Pathway level card
Used on `/programs`. Each of 4 levels gets one card.

```
┌─────────────────────────────┐
│ 🔴                          │  ← Ball-color icon, 48px
│ LEVEL 1 — DISCOVERY         │  ← Montserrat Bold, pathway color
│ First paddle in hand...     │  ← Inter Regular, Ink
│                             │
│ Ages 5–7                    │  ← Roboto Mono, small
│ → Book a free evaluation    │  ← CTA, pathway color
└─────────────────────────────┘
```

### CTA button

| State | Style |
|---|---|
| Primary | Pathway color bg + white text, 12px radius, 16px padding |
| Secondary | White bg + pathway color border & text |
| Disabled | gray-200 bg + gray-500 text |

Hover: darken by 10% (use the `-700` variant of the pathway color).

### Section backplate
Alternate white and gray-50 between sections to create rhythm. Never stack two pathway-color sections adjacent.

---

## 6. Motion & Interaction

- **Default transition:** 150ms ease-out on hover / focus.
- **No auto-playing video with sound** — muted auto-play only, with a clear mute/unmute toggle.
- **Reduced motion respected** — honor `prefers-reduced-motion: reduce`.
- **No parallax on mobile** — causes motion sickness; respect the constraint.

---

## 7. Accessibility

Baseline: WCAG 2.1 AA.

- Contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text.
- Focus states visible (2px pathway-color outline).
- All interactive elements keyboard-accessible.
- Alt text on all imagery (especially kid photos — describe the action, not just "kid playing").
- Form labels always visible (no placeholder-as-label).

---

## 8. What's still to build (Part 1 backlog)

- Final logo lockups (5 variants listed in §1)
- Illustration library (consistent line weight, pathway-color fills)
- Iconography set (activity icons: paddle, ball, court, coach, parent, kid)
- Print templates (flyer, business card, one-pager, season brochure)
- T-shirt / uniform design
- Social media templates (IG Story, IG Post, TikTok, Reel cover)
- Email header/footer assets

---

## 9. Changelog

- **2026-04-18 v1.1** — Full rewrite. Replaced stale LD mirror with NGA-specific Part 1. Color palette locked to Pathway Rainbow using actual site hex values (`DC2626/EA580C/16A34A/CA8A04`). Typography confirmed from `next/font/google` config (Montserrat + Inter). Added component patterns, motion rules, accessibility baseline.
- **2025-08-19 v1.0** — Original Notion brand guide (working specs only).
