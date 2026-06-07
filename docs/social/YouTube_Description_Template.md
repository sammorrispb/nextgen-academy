# YouTube Description Template

Reusable YouTube video-description template for **Next Gen Pickleball Academy**
and the sister family brand **Link and Dink**. Goal: a consistent, SEO-sound
description on every upload that drives viewers to a free newsletter sign-up.

**Source of truth:** `BRAND_GUIDELINES.md` (copy guardrails) and
`src/data/site.ts` (handles, tagline). Sister-brand cross-links are allowed —
`linkanddink.com` is a Sam Morris family brand (see JSON-LD `sameAs` in
`src/app/layout.tsx`). Dill Dinkers / CourtReserve / The Hub remain off-limits.

> Primary CTA on every video: **free newsletter sign-up.**
> NGA newsletter: https://nextgenpbacademy.com/newsletter
> Link and Dink newsletter: https://www.linkanddink.com/#newsletter

---

## Platform best practices (reviewed 2026)

- **First ~100 characters are everything.** YouTube truncates at the "show more"
  fold, so line 1 must carry the primary keyword **and** the main link. Treat it
  as a search snippet.
- **First 1–2 sentences** explain what the video is — for the viewer and the
  algorithm. Weave in related keywords naturally; don't stuff.
- **Length:** 200–500 words is the optimal range for ranking.
- **Links:** 3–7 total. Put the most important one in the first three lines.
- **Chapters/timestamps:** required for videos over ~5 min — they raise average
  view duration. Skip for short clips.
- **Hashtags:** 3–5 max (only the first 3 show above the title); more risks a
  spam flag.
- **One primary CTA** (newsletter). The free-evaluation line is secondary.

---

## Template

Pick the **top block** for the video's brand, then keep the **shared body** the
same on every upload. Fill the `[brackets]`.

### Top block — Link and Dink video

> Top-level pickleball in the Mid-Atlantic. 📬 Get the newsletter → https://www.linkanddink.com/#newsletter
>
> [1–2 keyword-rich sentences on this video — e.g. "Highlights and match
> breakdowns from Brickwall Pro tournament play across Maryland, Virginia,
> and DC."]

### Top block — Next Gen Academy video

> Youth pickleball in Montgomery County, MD (ages 6–16). 📬 Get the newsletter → https://nextgenpbacademy.com/newsletter
>
> [1–2 keyword-rich sentences on this video — e.g. "Inside a Next Gen Academy
> session: real reps, real progress, on the Red → Yellow pathway."]

### Shared body (every video)

> In this video:
> • [point 1]
> • [point 2]
> • [point 3]
>
> 📬 JOIN A NEWSLETTER (free)
> → Next Gen Pickleball Academy — youth, ages 6–16, Montgomery County MD: https://nextgenpbacademy.com/newsletter
> → Link and Dink — top-level pickleball in the Mid-Atlantic: https://www.linkanddink.com/#newsletter
>
> New to youth pickleball? Book a free evaluation: https://nextgenpbacademy.com/free-evaluation
>
> ⏱️ CHAPTERS  (only for videos over ~5 min)
> 0:00 Intro
> 0:00 [section]
> 0:00 [section]
>
> 🔗 MORE
> Next Gen site: https://nextgenpbacademy.com
> Instagram: @nextgenpickleballacademy
> Link and Dink: https://www.linkanddink.com
>
> #Pickleball #YouthPickleball #MoCo

---

## Voice guardrails (from `BRAND_GUIDELINES.md`)

- No hard prices in the description (tease, don't quote).
- Skill levels are Red / Orange / Green / Yellow — never "Beginner / Pro."
- Ages **6–16 is strict** for Next Gen content.
- Yellow Ball is invite-only — no public registration CTA.
- Emoji: functional only (📬 ⏱️ 🔗), never decorative garnish.

## Pre-publish checklist

- [ ] Line 1 has the primary keyword **and** the newsletter link (before the fold).
- [ ] Correct brand top block selected.
- [ ] 3–7 links total; most important one in the first three lines.
- [ ] Chapters added if the video is over ~5 min.
- [ ] 3–5 hashtags, the first 3 being the ones you most want above the title.
- [ ] One primary CTA (newsletter); free-eval stays secondary.
- [ ] No hard prices; Red/Orange/Green/Yellow naming if levels are mentioned.

---

*Re-verify the platform best-practices section periodically — YouTube's
truncation/ranking rules drift. Keep in sync with `BRAND_GUIDELINES.md`.*
