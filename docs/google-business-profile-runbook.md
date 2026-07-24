# Google Business Profile — NGA setup runbook

The #1 discovery gap per `docs/marketing/moco-discovery-review-2026-07.md`
(Phase 2, item 5): "pickleball lessons for kids near me" resolves in the Google
local pack, and NGA has no pin, no reviews, no presence there. This runbook is
the Sam-led, no-code setup (~20 min + verification wait). The camp follow-up
email (`POST /api/camp-followup`) is blocked on it: live sends refuse until
`NGA_GOOGLE_REVIEW_URL` is set, and that URL only exists once this profile does.

## 1. Create the profile (business.google.com)

Sign in as **nextgenacademypb@gmail.com** (the academy inbox — keeps the
profile with the business identity, not a personal account). After creation,
add sam.morris2131@gmail.com as a **Manager** under People & access.

Field-by-field:

| Field | Value |
| --- | --- |
| Business name | `Next Gen Pickleball Academy` — exactly this. No taglines, no "MoCo", no keyword stuffing (Google suspends profiles for it). |
| Business type | **Service-area business** — "I deliver goods and services to my customers." Do NOT list a storefront address. Sessions rotate school venues we don't control, and pinning a school conflicts with the child-safety location posture. Google still asks for a mailing address for verification — use the business mailing address; it stays hidden on a service-area profile. |
| Primary category | `Sports school` |
| Secondary categories | Search and add what exists: `Sports club`, `Summer camp` (real GBP category — covers the camp product), and a coaching/training category if offered. |
| Service area | Montgomery County, MD. If it wants cities, list the eight we already target: Rockville, Gaithersburg, Bethesda, North Bethesda, Germantown, Olney, Potomac, Silver Spring. |
| Phone | `301-325-4731` |
| Website | `https://nextgenpbacademy.com` |
| Hours | Sat–Sun 6:00–8:00 PM (the weekend session block). Camps/lessons vary — that's fine; hours here signal "when group play runs." |

**Description** (Google cap is 750 chars — this is ready to paste):

> Next Gen Pickleball Academy is youth pickleball coaching for kids ages 6–16
> across Montgomery County, MD. Every player grows through our four-level
> ladder — Red, Orange, Green, and Yellow Ball — with weekend group sessions,
> private lessons, school programs, and summer camps led by experienced,
> encouraging coaches. Every level is welcome at group play, and every new
> family starts with a free evaluation so your kid lands in the right spot on
> day one. Better than yesterday, together.

(No prices — pricing stays teased per the standing rule.)

## 2. Verify

Service-area businesses almost always get **video verification**: a live or
recorded walkthrough proving the business is real (equipment, branding,
yourself coaching). Have paddles/cart/NGA materials on hand. Review typically
clears in hours to ~5 business days. Until verified, the profile is invisible —
don't stop at step 1.

## 3. Grab the review link → unblock the camp follow-up

1. In the GBP dashboard, hit **Ask for reviews** — copy the short share link
   (`https://g.page/r/.../review`).
2. Vercel → nextgen-academy → Settings → Environment Variables → add
   `NGA_GOOGLE_REVIEW_URL` = that link (Production). No redeploy needed — the
   route reads it at request time.
3. Dry-run, eyeball, send:
   ```bash
   curl -X POST "https://nextgenpbacademy.com/api/camp-followup?secret=$NGA_ADMIN_SECRET" \
     -H 'Content-Type: application/json' -d '{"dryRun": true}'
   ```
   Then re-run without `dryRun`. The discovery review's math: ~20 family
   reviews ≈ enough to own the youth-pickleball local pack in MoCo, which has
   no incumbent — the camp follow-up + future post-eval asks are the engine.

## 4. Repeat cheaply elsewhere (same session, ~15 min)

- **Bing Places** (bingplaces.com) — "Import from Google Business Profile"
  copies everything.
- **Apple Business Connect** (businessconnect.apple.com) — Maps presence for
  iPhone parents.
- L&D gets its own profile (`Link & Dink`, category Sports club) per the same
  discovery-review item — separate sign-in session, same steps.
