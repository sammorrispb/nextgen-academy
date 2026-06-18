# NGA Session Cadence Playbook — Poll → Register → Last Call

**Owner:** Sam · **Created:** 2026-05-29 · **Config:** `cadence_config.json` (this folder, single source of truth)
**Canonical copy:** `nextgen-academy/docs/ops/` (the cloud routine clones this repo to read it). Keep the `~/Documents/NGA/06_operations/` copy byte-identical — edit one, mirror the other.

A repeatable weekly rhythm for standing up NGA weekend sessions: poll families on venue + day, open registration once demand is known and courts are booked, then drive last-minute fills — all riding the existing **Thursday NGA newsletter**.

---

## The model — 3-2-0 rolling

One weekly **beat** = the Thursday newsletter. Each issue carries up to three blocks at once, each for a different event weekend:

| Block | Targets the event weekend… | Controlling newsletter |
|---|---|---|
| **POLL** (first call) | ~3 weeks out | ~T-17 days |
| **REGISTER** (open) | ~2 weeks out | ~T-10 days |
| **LAST CALL** | this week | ~T-2 days (the Thursday before) |

So a single event weekend moves through **three consecutive Thursday newsletters**: polled → registration opened → last call.

**Why poll *before* booking:** ActiveMontgomery's max-refund cancel-by is ~10 business days out (≈ T-14 calendar days). If you book first and the session under-fills, you're past the refund cliff and forfeit the fees. The poll at T-17 tells you which venue has real demand, so you only commit money (book the court) at the register stage if it will fill. **The poll is the risk gate, not just marketing.**

**Format (v2, 2026-05-30):** one **1-hour session, Saturdays 10:00–11:00 AM**, **$20/player**, at a **single rotating venue per weekend** — cycling **Walter Johnson HS → Gaithersburg HS → Sherwood HS** (per-weekend assignment pinned in `cadence_config.json` → `eventWeekends[].venue`). No Sunday session, no Early/Late split, no two-hour bundle. The poll now picks the venue only (day is fixed).

---

## Skip / hold weekends

- **Skip:** Jun 20–21, Jul 4–5, **Jul 11–12** (whole weekend — Sat 7/11 is in the skip window; confirm if you'd rather run Sun 7/12).
- **Hold:** **August is frozen** (`seasonHoldFrom: 2026-08-01`). The calendar below runs through **Jul 25–26**. Any block that would target a held/skip weekend is simply omitted from that week's newsletter. Unfreeze August by extending `eventWeekends` in the config and pushing `seasonHoldFrom` out — the routine then picks the new weekends up automatically.

---

## Dated calendar (through July 2026)

| Event weekend | POLL newsletter | REGISTER / book-by newsletter | LAST CALL newsletter |
|---|---|---|---|
| Jun 6–7 *(ramp-up)* | — | Thu Jun 4 *(compressed)* | Thu Jun 4 |
| Jun 13–14 *(ramp-up)* | — | Thu Jun 4 | Thu Jun 11 |
| **Jun 20–21** | **SKIP** | — | — |
| Jun 27–28 *(first full cycle)* | Thu Jun 11 | Thu Jun 18 | Thu Jun 25 |
| **Jul 4–5** | **SKIP** | — | — |
| **Jul 11–12** | **SKIP** | — | — |
| Jul 18–19 | Thu Jul 2 | Thu Jul 9 | Thu Jul 16 |
| Jul 25–26 | Thu Jul 9 | Thu Jul 16 | Thu Jul 23 |
| Aug 1+ | **HOLD** | — | — |

**Per-newsletter view (what each issue carries):**

| Thursday | POLL | REGISTER | LAST CALL |
|---|---|---|---|
| Jun 4 | — | Jun 6–7 + Jun 13–14 | Jun 6–7 |
| Jun 11 | Jun 27–28 | — *(Jun 20–21 skip)* | Jun 13–14 |
| Jun 18 | — *(Jul 4–5 skip)* | Jun 27–28 | — *(Jun 20–21 skip)* |
| Jun 25 | — *(Jul 11–12 skip)* | — *(Jul 4–5 skip)* | Jun 27–28 |
| Jul 2 | Jul 18–19 | — *(Jul 11–12 skip)* | — *(Jul 4–5 skip)* |
| Jul 9 | Jul 25–26 | Jul 18–19 | — *(Jul 11–12 skip)* |
| Jul 16 | — *(Aug 1–2 HOLD)* | Jul 25–26 | Jul 18–19 |
| Jul 23 | — *(HOLD)* | — *(HOLD)* | Jul 25–26 |

*(Gaps are expected — the skip/hold weekends thin out blocks. From late July onward the cadence winds down unless August is unfrozen.)*

---

## Weekly checklist (Sam — runs against each Thursday newsletter)

The Tuesday routine does the drafting + reminding. Your manual steps:

1. **Close last week's poll.** Open the Google Sheet (`pollForm.responsesSheetUrl`); the venue is pinned per weekend in `cadence_config.json → eventWeekends[].venue` (WJHS → GHS → Sherwood rotation), so the poll mainly gauges turnout/interest for the Saturday at the REGISTER stage. *(v1: you tally by hand — the routine reminds you but does not read the Sheet.)*
2. **Book the venue's court on ActiveMontgomery** via `/am-book` for that Saturday if demand justifies it (≥1 court). Log it in `AM_Booking_Log.md`.
3. **Create the Notion session row** for what you booked: Date, Start/End (**10:00–11:00 AM**, single 1-hour session), Location, court count, capacity, Status = **Open**. Within the 30-day window it appears on `/schedule` automatically.
4. **Review + approve the newsletter draft.** The routine wrote the POLL / REGISTER / LAST-CALL blocks into the **single shared weekly Newsletter Drafts row** (the Wednesday editorial drafter appends its sections to the *same* row). Sanity-check voice (already run through `brand-review-nga`), confirm the booked sessions match the REGISTER block, flip Status → **Approved** before Thu 6pm ET.
5. **(Optional, for new-lead reach)** Paste the routine's **FB/IG + WhatsApp** variants of the REGISTER + LAST-CALL blocks into the parent groups / socials. The newsletter hits current families; this is the acquisition surface.

> The routine never books, charges, or sends on its own. Booking is identity- + payment-bound; the newsletter ships only when you set the row to Approved.

---

## Poll asset — Google Form (LIVE)

Created **once**, reused every week (the weekend is a field, so you never make a new Form). Live URLs are in `cadence_config.json → pollForm`.

**Form name:** `NGA — Vote the Next Session`
**Fields:**
1. *Which weekend are you voting for?* — short answer or dropdown (the routine tells families which weekend in the newsletter copy; a dropdown of upcoming weekends is cleaner).
2. *Venue preference* — multiple choice: `Walter Johnson HS (Bethesda)` / `Gaithersburg HS` / `Sherwood HS (Sandy Spring)` / `Either works`. (All three venues are live on the Form as of 2026-05-30 — verified 2026-06-18.)
3. ~~*Day preference*~~ — **removed.** Sessions are Saturday-only (10:00–11:00 AM); the day question is obsolete in v2.
4. *Player age* — short answer (sanity-check the 5–16 band + group sizing).
5. *Name / contact (optional)* — short answer (lets you follow up with voters when registration opens).

**Wire-up:** Responses → Google Sheet (`pollForm.responsesSheetUrl`). The newsletter poll block links to `pollForm.url` as two/three buttons (e.g. "🗳️ Vote: Walter Johnson", "🗳️ Vote: Gaithersburg", or a single "Vote the next session →"). The routine drafts this copy.

> **Future enhancement (auto-tally):** set the responses Sheet to link-viewable / publish-to-web CSV, then add a CSV-fetch step to the routine so it summarizes votes automatically instead of reminding Sam to tally by hand.

---

## Automated routine — "NGA Session Cadence" (`/schedule`, weekly Tue)

Create via the `/schedule` skill. Runs **Tuesday morning** (~7am ET, `0 11 * * 2` UTC during EDT), **ahead of the Wednesday newsletter drafter so the shared weekly Notion row exists first**, matching the News-Radar/drafter cloud-routine pattern. Routine prompt:

> **NGA Session Cadence — weekly draft + ops checklist.**
> Shallow-clone `sammorrispb/nextgen-academy` and read `docs/ops/cadence_config.json` (+ this `Session_Cadence_Playbook.md` for the calendar) — the cloud routine can't read local `~/Documents`. Using today's date (America/New_York) and the 3-2-0 `leadOffsetsWeeks`, determine which event weekend (if any) is at each stage this week: POLL (~T-17), REGISTER (~T-10), LAST CALL (~T-2). Honor `skipWeekends` and `seasonHoldFrom` — omit any block whose target weekend is a skip or on/after the hold date (August frozen).
>
> Draft, in NGA Coach voice and self-gated through `/brand-review-nga`:
> 1. **POLL block** — vote CTA for the T-17 weekend, button(s) → `pollForm.url`.
> 2. **REGISTER block** — "registration open" for the booked T-10 weekend, link `nextgenpbacademy.com/schedule`.
> 3. **LAST-CALL block** — final push for the T-2 weekend.
> 4. **FB/IG + WhatsApp paste variants** of the REGISTER + LAST-CALL blocks (for the ops checklist, not the Notion row).
>
> **Find-or-create the shared weekly row** in the **NGA Newsletter Drafts** Notion DB: compute the upcoming-Thursday ISO date (America/New_York) as the week key; query for a `Status = Pending` row with `Week` = `Week of YYYY-MM-DD`. If none exists, create it (`Status = Pending`, `Drafted At` = today, `Week` title set). Append blocks 1–3 to that row's page body under a `## Session cadence` heading/divider. (The Wednesday editorial drafter finds the same row by the same key and appends its sections under `## From Coach Sam`, so one Pending row carries everything Sam approves once.)
>
> Output a **Sam ops checklist**: **open the poll responses Sheet (`pollForm.responsesSheetUrl`) and tally venue (WJHS/GHS) + day (Sat/Sun) for the REGISTER weekend** (manual in v1); the exact venue/day to book on ActiveMontgomery (`/am-book`); the Notion session row(s) to create; plus the FB/IG + WhatsApp paste variants. Deliver via the routine output / Slack.
>
> **Do NOT** book courts, charge cards, create Notion session rows, or send the newsletter — draft + remind only.

**Coordination — Wednesday drafter:** the existing "NGA Newsletter Drafter" routine (`trig_01CS13QeZxuCndRhB3mUJRNB`) is edited to **find the current-week shared row by the same `Week of YYYY-MM-DD` key and append** its editorial sections, creating the row only as a fallback if the cadence routine didn't. This keeps exactly **one Pending Newsletter Drafts row per week** so the Thursday cron (which injects the single most-recent Approved row) carries both the cadence blocks and the editorial sections. **3a (this routine) and 3b (the drafter edit) must ship together** — otherwise the drafter creates a second row that wins the cron pick and the cadence blocks are dropped.

**Prerequisite before first run:** the Google Form + Sheet exist and their URLs are in `cadence_config.json` (done — `pollForm.status: LIVE`), and `docs/ops/cadence_config.json` is committed to `main` so the routine can clone it.
