# Youth Pickleball League — Build Spec (community-os execution)

> **Companion to** `youth-pickleball-league-blueprint.md` (the *product* design)
> and `youth-pickleball-league-launch-readiness.md` (the *launch* gate register).
> Those two designed *what the league is* and *what it takes to charge for it*.
> **This file is the executable engineering spec** for the league *app* — the
> two resolved technical decisions, the concrete data model, the engine→growth
> ingest mapping, and the phase-by-phase build order — so `community-os` can
> build without re-deriving anything.

---

## 0. What shipped on the NGA side (this session)

The two fully-deliverable NGA-side items are **done and live in this repo** (they
were the documented paid-launch gate / Phase 4 surface):

- **`/league` marketing page** — dark theme, JsonLd (BreadcrumbList + Course),
  price *teased not quoted*, growth-only copy, the four age divisions, the
  progression/badge story, a season-terms/refund block (CUPF-aligned), and an
  **interest-capture CTA** (no live public checkout). Links out to the growth
  app via `NEXT_PUBLIC_LEAGUE_APP_URL` when set. Passes `verify-funnel.mjs`.
- **League interest pipeline** — `LeagueInterestForm` → `POST /api/league-interest`
  → fail-soft Notion write (`NOTION_LEAGUE_INTEREST_DB_ID`) + Resend
  admin/parent emails + **Open Brain ingest `source: "nga_league_interest"`**.
  This *is* launch-readiness **P2 #12** ("can you fill a division?") — every
  submission is a clean, banded demand signal on the family's OB profile.
- **Season Stripe scaffold (full-pay only, env-gated)** — `src/data/leagues.ts`
  (bands + season product), `validateLeagueForm`, `POST /api/checkout-league`
  (503 "enrollment isn't open yet" until `STRIPE_LEAGUE_SEASON_PRICE_ID` is set),
  `kind:"league"` webhook branch (`handleLeagueCheckout` → admin/parent email +
  Player-CRM sync + OB `nga_league_enrollment`), and `/league/success`.
  **Not surfaced publicly yet** — going live is: create the Stripe price → set
  the env var → swap the page CTA from interest-form to checkout.

Deferred per the agreed full-pay-only call (documented, not built):
`STRIPE_LEAGUE_DEPOSIT_PRICE_ID` (deposit-then-balance) and
`STRIPE_LEAGUE_PLAN_PRICE_ID` (installments).

**Hard blocker carried forward:** `community-os` and `nga-coaching-system` are
not in this session's GitHub scope, and the repo-management tools
(`list_repos`/`add_repo`) weren't connected — so the Phase 1–3 app code below
could not be pushed to its repo, and the shared-vocabulary CSV couldn't be
pulled live. This spec is what unblocks that work the moment the repos are in
scope.

---

## 1. Resolved technical decisions

### Decision 1 — Child identity join (RESOLVED)

**The key is `familyKey + normalized childFirstName (+ childBirthYear to
disambiguate siblings)`, bridged via Open Brain in the interim.**

- **`familyKey`** = NGA's existing base64url family key from
  `encodeParentKey(parentEmail, parentPhone)` (`src/lib/player-profiles.ts`).
  This is already the join used across the Notion drop-in rows and the coach
  dashboard family profiles — reuse it verbatim so a league child resolves to
  the same family as their drop-ins, attendance, and payments.
- **Child within family** = `normalize(childFirstName)` (lowercase + trim),
  with **`childBirthYear`** as the tiebreaker for same-name siblings. (Birth
  year, not age, because age drifts; every NGA surface already stores
  `child_birth_year`.)
- **Bridge = Open Brain, not a new identity spine.** community-os' identity
  spine is **not** confirmed ready, so do **not** block on it. The existing
  `nga_attendance` OB activity *already* carries `email` / `phone` +
  `metadata.child_first_name` + `metadata.child_birth_year` — that is the
  ready-made join surface between NGA families and engine play. The new
  `nga_league_enrollment` and `nga_league_interest` activities carry the same
  keys, so a child threads cleanly across enrollment → attendance → play.
- **Engine `playerId` ↔ child** is stored as an explicit mapping on
  `league_enrollment(family_key, child_first_name, child_birth_year,
  engine_player_id)`. The engine's `playerId` is opaque; this row is the only
  place it's tied back to a real child. Write it at enrollment (or first
  session), read it on every stat ingest.

**Canonical rule (write this into the app):**
```
childKey(record) = sha or tuple of:
  encodeParentKey(parentEmail, parentPhone)   // family
  + normalizeFirstName(childFirstName)         // child
  + childBirthYear                             // sibling disambiguation
```
Resolve NGA Notion rows and OB `nga_attendance` activities to the same
`childKey`; `league_enrollment.engine_player_id` ties that key to the engine.

### Decision 2 — Courtside score path v1 (RESOLVED)

- **14U / 16U → P3 SMS agent.** Older bands self-officiate and use the
  Twilio SMS agent (`start` / `lock` / `status`) in `apps/p3` — no-app, courtside.
- **7U / 10U → coach enters via the live web client.** Younger bands don't
  self-report; the coach (or a vetted parent volunteer) enters scores in the P3
  live runner.

This is the blueprint default, now confirmed as the v1 path. Both feed the same
engine `standings()`; the growth ingest (§3) doesn't care which entry path
produced the numbers.

---

## 2. Data model (Supabase — community-os)

> Target DB: Supabase **`link-and-dink`** (the P3/engine project). Confirm
> against the live engine tables before applying — names below are the intended
> shape, not a verified migration. All player-facing reads enforce the
> **growth-only** rule: no query returns another child's stats to a family.

```sql
-- A season of a single band at a single venue/slot.
create table league_season (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,        -- e.g. 'fall-2026-10u'
  title           text not null,               -- 'Fall 2026 League — 10U'
  season_label    text not null,               -- 'Fall 2026' (public)
  band            text not null,               -- '7U' | '10U' | '14U' | '16U'
  start_date      date not null,
  end_date        date not null,               -- 8 sessions across 9–10 weeks
  public_area     text not null,               -- broad area (public)
  exact_location  text,                         -- venue (private, roster only)
  created_at      timestamptz default now()
);

-- One enrolled child in a season. The identity-join row (Decision 1).
create table league_enrollment (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references league_season(id),
  family_key        text not null,             -- encodeParentKey(email, phone)
  child_first_name  text not null,
  child_birth_year  int  not null,
  engine_player_id  text,                       -- ↔ engine playerId (Decision 1)
  parent_email      text,
  parent_phone      text,
  stripe_session_id text,                       -- ties to NGA checkout-league
  status            text not null default 'enrolled',
  created_at        timestamptz default now(),
  unique (season_id, family_key, child_first_name, child_birth_year)
);

-- One session of a season: the coach's run-sheet inputs.
create table session_block (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid not null references league_season(id),
  session_date    date not null,
  week_no         int  not null,                -- 1..8
  objective       text,                          -- single coach focus
  word_of_the_day text,                          -- an EASE value
  drill_refs      jsonb default '[]',            -- refs into nga-coaching-system
  created_at      timestamptz default now(),
  unique (season_id, session_date)
);

-- The growth feed — one row per attending child per session. Derived from the
-- engine standings (§3); the RANKING is discarded, only per-child stats kept.
create table player_session_stat (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references league_enrollment(id),
  session_block_id uuid not null references session_block(id),
  touches         int,                           -- proxy: pointsFor (see §3)
  games_played    int,
  games_won       int,                           -- standings.wins
  longest_rally   int,                           -- if captured; else null
  attended        boolean not null default true,
  created_at      timestamptz default now(),
  unique (enrollment_id, session_block_id)
);

-- The skill checklist catalogue (seed from the vocab CSV — see §5).
create table skill_stamp (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,              -- 'third_shot_drop'
  name        text not null,                     -- 'Third-Shot Drop'
  level       text not null,                     -- 'Red'|'Orange'|'Green'|'Yellow'
  category    text,                              -- Control/Power/Positioning/Gameplay
  vocab_l1    text,                              -- reconcile to CSV L1
  vocab_l2    text                               -- reconcile to CSV L2
);

-- A child unlocking a skill stamp (coach-confirmed, fires immediately).
create table child_skill (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references league_enrollment(id),
  skill_stamp_id  uuid not null references skill_stamp(id),
  awarded_by      text,                          -- coach id
  awarded_at      timestamptz default now(),
  session_block_id uuid references session_block(id),
  unique (enrollment_id, skill_stamp_id)
);

-- Coach-confirmed level-up (Red→Orange→Green→Yellow). Values-gated.
create table level_progression (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references league_enrollment(id),
  from_level      text not null,
  to_level        text not null,
  values_gate_met boolean not null default false, -- EASE row required
  awarded_by      text,
  awarded_at      timestamptz default now()
);
```

**Growth-only constraint (enforce in the app, not just convention):** any
parent/kid-facing read filters to a single `enrollment_id` resolved from the
authenticated family's `childKey`. There is no endpoint that returns a season
roster's stats to a family. A coach-private balancing view may read across
enrollments; it is never exposed to a parent token.

---

## 3. Engine `standings()` → `player_session_stat` ingest

The engine (`packages/tournament`, format `rp_04` = 4 players, 6 rounds, every
pair twice) exposes `standings()` per player after a session. Map it **per
attending child**, then discard the ordering:

| `player_session_stat` column | engine source | note |
|---|---|---|
| `games_won` | `standings[player].wins` | direct |
| `games_played` | rounds the player appeared in (6 for a full `rp_04`) | direct |
| `touches` | `standings[player].pointsFor` | **proxy** — pointsFor is the closest engine signal to "touches"; rename in-app to whatever the parent view calls it, but treat as a growth counter, not an exact hit count |
| `longest_rally` | only if the live client captures it | else `null` |
| `attended` | presence in the session's engine run | drives streak/attendance badges |

**The ranking (`standings` order) is read once to extract per-child rows, then
thrown away** — never persisted, never shown to a family. Resolve each engine
`player` to an `enrollment_id` via `league_enrollment.engine_player_id`
(Decision 1). Write one `player_session_stat` per attending child per
`session_block` (the `unique` constraint makes re-ingest idempotent).

---

## 4. Parent growth view (spec)

A logged-in parent sees **only their own child** (resolved via `childKey`):

- Touches & games over the season (their own trend line).
- Win rate vs. **their own trailing average** — never vs. peers.
- Personal bests (longest rally, best touches-in-a-session).
- Attendance streak.
- Skills unlocked (`child_skill` joined to `skill_stamp`) + the next unlock.
- Current level + level-up history (`level_progression`).

No leaderboard, no peer comparison, no season roster stats. Any in-session
celebration (e.g. "most improved today") is presented in the moment and **never
persisted as a ranking** — the only persisted "most improved" is the finale
award measured against the child's *own* Week-1 baseline.

---

## 5. Skill-stamp seeding (BLOCKED — needs nga-coaching-system)

Seed `skill_stamp` from the **shared-vocabulary CSV** in `nga-coaching-system`
(categories Methodology/Gameplay/Control/Power/Positioning; terms like
Reset-From-Transition, Speed-Up, Shake-and-Bake, Stack-and-Switch Signals). The
blueprint's per-level checklists (Red→Orange→Green→Yellow) are the draft stamp
list, but **exact names + L1/L2 must be reconciled against the live CSV** — this
is blocked until that repo is in scope. The blueprint flagged the same gap;
nothing here resolves it, it just records where the names land (`skill_stamp.vocab_l1`,
`skill_stamp.vocab_l2`).

---

## 6. Build order (community-os)

- **Phase 0 — paper pilot (no code).** Run one band (likely **10U** — golden
  skill age, easiest to fill) on the existing all-levels Tuesday using P3 for
  `rp_04` + a manual growth sheet. Validates the routine + the "parents pay for
  the growth curve" hypothesis under existing drop-in cover (no new legal
  surface). Runs in parallel with the NGA interest-capture demand signal now live.
- **Phase 1 — growth record.** Tables §2; identity join §1; `player_session_stat`
  ingest §3; minimal parent growth view §4; skill stamps from §5 (draft names
  until CSV reconciled).
- **Phase 2 — coach run-sheet.** `session_block` editing (objective, Word-of-the-Day,
  drill cards from nga-coaching-system), `rp_04` auto-setup, confirm courtside
  score entry (Decision 2: SMS for 14U/16U, web client for 7U/10U).
- **Phase 3 — enrollment + comms.** Bridge season enrollment from NGA (the
  `checkout-league` webhook already emits `nga_league_enrollment` to OB and a
  `stripe_session_id` — consume it to create `league_enrollment`); EASE-framed
  growth-digest email; level-up + badge celebration comms.
- **Phase 4 — NGA surfacing.** ✅ **Done this session** (`/league` + interest +
  season scaffold). When the app ships, set `NEXT_PUBLIC_LEAGUE_APP_URL` so the
  page's "Open the dashboard" card appears.

---

## 7. Acceptance criteria

- **Engine:** a 4-kid court produces `rp_04` = 6 rounds, every pair twice
  (engine run-file + e2e already cover this).
- **Growth feed:** a completed pilot session yields exactly one
  `player_session_stat` per attending child (non-null `touches`/`games_played`),
  and the parent view renders **only that child** (no peer data leak).
- **Identity:** one real family resolves to the same `childKey` across (a) an NGA
  Notion drop-in/enrollment row, (b) an Open Brain `nga_attendance` activity, and
  (c) an engine `playerId` via `league_enrollment.engine_player_id`.
- **NGA side (Phase 4):** `npm run build` clean; `node scripts/verify-funnel.mjs`
  passes; `/league` price teased not quoted; `checkout-league` 503s until the
  season price ID is set. ✅ verified this session.

---

## 8. Open / carried-forward items

- **Repo scope:** get `community-os` + `nga-coaching-system` into a session to
  (a) push Phase 1–3 code and (b) pull the vocab CSV for §5 reconciliation.
- **Supabase target:** confirm the `link-and-dink` project's existing engine
  tables before applying §2 (avoid name collisions with the tournament schema).
- **P0 launch gate (from launch-readiness):** right-to-operate permit, insurance
  (GL + abuse/molestation), legal entity, adult vetting, enrollment paperwork —
  all must clear before the season checkout flips from scaffold to live and
  before any season money is taken.
