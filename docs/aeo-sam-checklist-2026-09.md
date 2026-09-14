# AEO follow-through — Sam-only steps (2026-09)

The code half of the 2026-09-13 answer-engine audit ships in one PR. These steps
need Sam's accounts, voice, or judgment. Rough order of leverage.

## Before merging the PR
- [ ] **Verify the Google Business Profile link.** Open
      `https://maps.google.com/?cid=13747039329786027007`. It was derived from the
      NGA listing's `fid` in the GBP dashboard (the same derivation that produces
      sammorrispb.com's live GBP link). If it doesn't land on the Next Gen
      Pickleball Academy profile, delete that one line from `ORG_SAME_AS` in
      `src/lib/seo.ts`.
- [ ] **Voice pass on the Frederick page copy** in `src/data/frederick.ts` (drafted
      by Claude). Keep the honesty rules at the top of that file.
- [ ] **Voice pass on the three new blog posts** in `src/data/blog.ts`.

## Google Business Profile (use the mobile app — the desktop editor's service-area
## and service-category rows are broken)
- [ ] Add **Frederick County, MD** (and Frederick) to the service area.
- [ ] Confirm categories include youth sports / pickleball instruction.
- [ ] Post each live season with its link: `/fall` (Sundays, Bethesda) and
      `/youth-pickleball-frederick` or `/picklpark` (Saturdays, Frederick).
- [ ] Seed Q&A from the site FAQ: "Do you run anything in Frederick County?",
      "How much do youth pickleball lessons cost?", "What ages do you accept?"
- [ ] Ask two or three happy families for a Google review. Reviews belong on GBP,
      never as on-site Review schema.

## Search Console (right after the deploy is live)
Request indexing for:
- [ ] `https://nextgenpbacademy.com/` (Google's snippet still quotes the retired drop-in figure)
- [ ] `https://nextgenpbacademy.com/montgomery-county-youth-pickleball` (same)
- [ ] `https://nextgenpbacademy.com/schedule` (same)
- [ ] `https://nextgenpbacademy.com/league`
- [ ] `https://nextgenpbacademy.com/picklpark`
- [ ] `https://nextgenpbacademy.com/levels`
- [ ] `https://nextgenpbacademy.com/youth-pickleball-frederick`
- [ ] `https://nextgenpbacademy.com/blog/best-age-to-start-pickleball`
- [ ] `https://nextgenpbacademy.com/blog/indoor-youth-pickleball-near-frederick-md`
- [ ] `https://nextgenpbacademy.com/blog/pickleball-vs-tennis-for-a-7-year-old`

## Bing + IndexNow (Bing's index feeds ChatGPT search and Copilot)
- [ ] Bing Webmaster Tools → **Import from Google Search Console** (verifies the
      site without a new meta tag).
- [ ] Mint a key (`openssl rand -hex 16`) and set `INDEXNOW_KEY` in the Vercel
      project (Production). Record it in `~/.claude/env-registry.md`.
      Then `curl -s https://nextgenpbacademy.com/indexnow-key.txt` should print it,
      and the Monday cron starts submitting.

## Off-site citations (answer engines weight these above the site itself)
- [ ] **Ask The Pickl Park for a link.** Draft:
      > Hi — thanks again for hosting the Saturday youth leagues. Would you add a
      > line to the youth league listings (and your programs page, if you have
      > one) that the leagues are coached by Next Gen Pickleball Academy, linking
      > to https://nextgenpbacademy.com/youth-pickleball-frederick? Happy to link
      > back to your listings from our side — we already do on /picklpark.
- [ ] Before creating any directory listing, **search first** that it doesn't
      already exist: Yelp, Apple Business Connect, Bing Places, Nextdoor.
- [ ] Refresh and send the April backlink drafts (MoCo Show, Bethesda Magazine,
      Visit Montgomery, Montgomery County Recreation) — now pointing at
      `/league` and `/montgomery-county-youth-pickleball`.
- [ ] Not doing: pushing NGA sessions to PlayTime Scheduler / Pickleheads. The
      `/event-syndicate` skill excludes youth sessions from adult pickup-game
      finders on purpose.

## Retention check before spending on the front door
- MoCo has a retention side: 272 known families; the Walter Johnson season sold
  9 of 18 seats to that warm list. Re-enrollment into the next season is worth
  more than new top-of-funnel.
- Frederick has no retention side yet (zero families in the CRM), so the work
  above is the only lever there.
