# Youth Pickleball League — Blueprint & Build Report

> **This session's deliverable is this report only — no code.** The league is to
> be built **natively in `community-os`** (it already owns the tournament engine,
> ladder, and multi-tenant spine). `nextgen-academy` links out to it;
> `nga-coaching-system` supplies the coaching framework. This file is the
> strategy/blueprint; implementation would be tracked in `community-os`.

---

## Decisions locked (at a glance)

| Area | Decision |
|---|---|
| **Build home** | `community-os` (reuse the engine natively); NGA links out |
| **This session** | Report/blueprint only — no code |
| **Overarching law** | **Growth-only** — no child-vs-child leaderboard ever shown to families |
| **Cohort banding** | Age-band first (who's on court together), ball-color level *within* the band |
| **Bands** | **7U / 10U / 14U / 16U** (standard junior divisions, "and under"; play up by approval, never down) |
| **Season** | **Fixed-roster, 8 weeks**, same cohort each week |
| **Intensity** | **Graduated** — cooperative juniors → competitive seniors |
| **Finale** | 7U/10U personal-best showcase; 14U/16U friendly tournament + Yellow scouting |
| **Play engine** | P3 `rp_04` per court of 4 (every pair twice); scores feed per-child growth, not a ladder |
| **Leveling** | Red→Orange→Green→Yellow, **coach gut, no fixed threshold**, **values-gated** |
| **Mentor role** | Formal 16U cross-band mentor; safeguarding is a launch blocker |
| **Badges** | 4 families; **age-inverted cadence**; stats auto / values+milestones coach-awarded; **physical passport (young) + digital (all)**; tiers I/II/III |
| **Disputes** | Generosity rule ("when in doubt, it's IN") → **RPS** tiebreaker → coach last |
| **Eyewear** | **Required, all bands, every session** |
| **Parent code** | **Warm norm, no formal teeth** — culture + 1:1 coach reminders |
| **Still to design** | Pricing/commitment · identity join + data model (build) |

---

## Context & intended outcome

Turn NGA's one-off drop-ins into a **structured youth league**: clear values, a
repeatable coaching framework, a fixed practice→play routine (same day, same
place), and an extended format for older kids that front-loads **30 min of
partner drilling to maximize touches** in a routine that **minimizes live
coaching**. The coach runs each session against pre-communicated objectives,
teaching **game strategy through modified, constraint-led games**. The P3
rotating-partner software runs the gameplay after drilling.

**Growth-only** is the defining choice. The engine is reused for what it's
uniquely good at — *fair rotating-partner pairings that maximize touches and
mixing* — but its scoring feeds each child's **personal progress record**
(touches, personal bests, skills unlocked, attendance streaks, level
progression), never a public ranking. Kid buy-in comes from **personal
milestones, badges, and a "Word of the Day,"** not from beating other kids.

**Outcome:** a recurring, low-overhead league parents pay into because they can
*see their own child improving*, and kids return to because every session is a
game whose stakes are *them vs. yesterday*.

---

## The league model

### Values & coaching framework (reuse, don't reinvent)
Anchor on **EASE** (Ethics, Attitude, Skills, Excellence) + the **two NGA
Pillars** + **constraint-led coaching**. Each session = one **block** with a
single coach objective + a rotating **Word of the Day** (an EASE value),
communicated at the start and revisited in the debrief.
- **Pillar 1 — Active Heart Rate:** every kid hitting/moving/coaching, always; ideal 1:4 ratio; the **Kid-Coach Role** turns a waiting kid into a coaching kid.
- **Pillar 2 — Feedback Density:** a by-name feedback touch to every kid every 2–5 min, tied to today's block focus.

These two pillars are what keep coaching overhead low even at 1.5–2 hrs.

### Banding & bands
Age-band first (safety + social fit), ball-color level *within* (equipment +
format). A child plays the lowest division their age fits; playing up is allowed
by coach approval, never down.

| Band | Ages | Ball (typical) | Intensity | Developmental stage |
|---|---|---|---|---|
| **7U** | 6–7 | Red (foam/low-bounce) | **Cooperative** — no win/lose | FUNdamentals |
| **10U** | 8–10 | Orange→Green | **Modified-competitive** | Learning to train (golden skill age) |
| **14U** | 11–14 | Green | **Competitive** | Training to train |
| **16U** | 15–16 | Green→Yellow | **Competitive + Yellow-Ball feeder** | Training to compete |

### Season shape & arc
**Fixed-roster, 8 weeks.** Same cohort every week → rotating partners means
**every kid partners every other kid repeatedly** over the season = the
structural form of *"better than yesterday — together,"* with no permanent
rival surface for cliques/ranking to form on.
- **Week 1 — Baseline / "combine":** each kid's *personal* starting point + their own goals (a benchmark to beat, not a ranking).
- **Weeks 2–7 — progressive blocks**, each with one coach focus; skills accumulate; mid-season check-in.
- **Week 8 — culmination, split by band:** 7U/10U get a **personal-best showcase + level-up ceremony** (parents invited, no bracket); 14U/16U get a **friendly tournament** that doubles as Yellow Ball scouting.

### Session routine (the "minimize coaching" engine)
A fixed, repeatable script so kids self-run and the coach floats:

| Phase | Younger bands | Older bands (90–120 min) | Purpose |
|---|---|---|---|
| Opener / Word of the Day | 5 min | 5–10 min | Set EASE theme + block objective |
| **Partner drilling (routine, max touches)** | 15 min | **30 min** | Touches > talk; fixed drill cards; coach floats with Feedback-Density touches |
| Constraint games (modified rules, strategy) | 15 min | 20–30 min | Gamified rules teach strategy; constraint-led |
| **Rotating-partner gameplay (P3 `rp_04`)** | 15 min | 30–40 min | Every kid partners every other; individual touches/wins logged |
| Debrief / personal bests | 5 min | 10 min | Tie back to objective; log each kid's growth |

Drill cards + the constraint-game catalogue are content in `nga-coaching-system`,
surfaced to the coach as a session "run sheet."

### Play format
- Per court of 4 (NGA cap) → engine **`rp_04`** (6 rounds, every pair twice). Courts within a band seeded by ball-color level so rotation stays fair.
- **Rally scoring + short/timed games** (not side-out): 7U cooperative targets only; 10U rally-to-7/9 win-by-1; 14U/16U rally-to-11 win-by-2 — keeps rotation on a predictable clock.
- **Constraints carry the strategy + gamification** (third-shot-drop required, dink-only, "point doubles if won at the net," cooperative rally-count targets). The game teaches.
- **Courtside score entry:** 16U self-officiate via the **P3 SMS agent**; coach enters for younger bands.
- The engine's `standings` (`pointsFor/wins` per player) are consumed as **per-child session stats, then the ranking is discarded.** (A coach-private balancing view is optional.)

### Growth-only gamification (the parent-facing payoff)
- **Per-child progress record** (what parents log in to see): touches/games, win rate vs. their *own* trailing average, personal bests (longest rally, points-for), attendance streak, skills unlocked, and level progression.
- **Buy-in without peer ranking:** badges, Word-of-the-Day callouts, streaks, a personal "better than yesterday" curve. Any in-session celebration (e.g. today's most-improved) is **never persisted as a ranking.**
- **No child-vs-child leaderboard anywhere in the family experience.**

---

## Per-level skill checklists (the growth-only engine)

> **Sourcing caveat:** built from NGA vocabulary *fragments* available this
> session (categories + terms tagged `[vocab]`) + standard pickleball pedagogy.
> **Reconcile exact wording against the live `nga-coaching-system`
> shared-vocabulary CSV** once that repo is in scope.

**Why this layer matters most:** since leveling is coach-gut and fires only ~3–4
times in a child's NGA life, the checklists (and the badges hung off them) are
what create a felt sense of progress *every session* — the engine that replaces
the missing leaderboard.

### How they work (design principles)
- **Kid-owned "I can…" language** — the child reads their own next unlock.
- **Assessed *inside* the constraint games, not as isolated tests** — the game is the assessment.
- **Values gate is mandatory** — a child cannot level up on skills alone; the EASE row must be met.
- **Leveling is pure coach judgment, no fixed threshold.** The numbers below (6-ball rally, 3/10 drops…) are **illustrative anchors of "what good looks like," not pass/fail counts.**
- **Parent-trust mitigation:** the "I can…" statements are concrete enough that a parent on the sideline can *see* the skill; the values gate keeps a level-up principled.
- **Coach-confirmed + celebrated**, firing immediately even mid-season.
- **Each checklist = a level-up badge; each item = a micro-badge.**

### 1 · RED → ORANGE  (7U: first touches → can rally)
*Body & ball control, cooperative rallying, basic rules. Foam/red ball, short court.*
- **Control:** keep a 6-ball cooperative rally alive (FH & BH); dink softly over the net 3× in a row; track + contact a feed from ready position.
- **Power:** underhand serve into the correct box 3 of 5; full swing without "chopping."
- **Positioning:** knows the kitchen line, doesn't volley from it; resets to ready position between hits.
- **Gameplay:** can state the cooperative game's target; takes turns + rotates partners without fuss.
- **Values gate:** *Attitude* — cheers for their partner. *Ethics* — truthful on out balls / net touches. *Skills* — can name + show the Word-of-the-Day skill.

### 2 · ORANGE → GREEN  (10U: rally → modified competition, tactics begin)
*Sustained rallying under movement, intro soft game + third shot, kitchen discipline. Golden skill-acquisition window — heaviest technical load.*
- **Control:** 10-ball cross-court dink rally; intro third-shot drop into the kitchen ~3 of 10; intro **Reset From Transition** `[vocab]`.
- **Power:** serve deep 4 of 5; drive off a bounce with topspin intent; return serve deep and advance.
- **Positioning:** advance to the kitchen line as a pair after the return; no kitchen faults; begins moving side-to-side with partner.
- **Gameplay:** choose drop vs. drive on the third shot; aim to open court; play a full rally-to-9 game + keep score.
- **Values gate:** *Attitude* — positive after losing a point. *Ethics* — honest calls even when costly. *Excellence* — names one thing improved since last week. *Kid-Coach* — can fairly ref a younger court.

### 3 · GREEN → YELLOW  (14U: competitive, full court, real strategy)
*Full soft game, transition mastery, the dink battle, speed-ups & resets, moving as a unit, composure under pressure.*
- **Control:** win a dink battle (move opponents, wait for the pop-up); reliable third-shot drop under pressure (6 of 10); consistent **Reset From Transition** `[vocab]`.
- **Power:** **Speed-Up** `[vocab]` off a high dink at the right moment; counter/block a speed-up in a hands battle; **Shake-and-Bake** `[vocab]` (partner drives, you crash).
- **Positioning:** move as a connected unit (no gaps); cover the middle, call "mine/yours"; know when to hold vs. retreat.
- **Gameplay:** build a point (drop → approach → dink → speed-up → finish); target the weaker opponent; rally-to-11 win-by-2 with composure.
- **Values gate:** *Attitude* — good partner to *any* rotated teammate. *Ethics* — owns faults, resolves calls calmly. *Excellence* — sets + tracks a personal session goal. *Mentor (begins)* — can run a younger-band drill station (safeguarding applies).

### 4 · YELLOW → YELLOW-BALL READY  (16U: tournament-invite readiness)
*Tournament-grade execution, stacking & signals, pressure performance, strategic IQ, leadership. Gate to the invite-only Yellow Ball track — coach evaluation, never public ranking.*
- **Control:** tournament-consistent drop + reset under live pressure (8 of 10); shot variety (drop/drive/lob/roll) chosen by situation.
- **Power:** offensive speed-ups *with placement* (at the body / into the gap); put-away discipline.
- **Positioning:** **Stacking** + **Stack-and-Switch Signals** `[vocab]`; full transition-zone game, never stuck in no-man's land.
- **Gameplay:** carry a game plan + adjust mid-match; exploit patterns, manage tempo/momentum; perform in bracket pressure (the finale is the proving ground).
- **Values gate (= Excellence):** confirmed, safeguarding-cleared **Mentor** modeling EASE program-wide; impeccable self-officiating under pressure; self-directs their development plan.
- **Gate:** coach evaluation → Yellow Ball invite (never auto, never public).

---

## Badge taxonomy (the week-to-week engagement engine)

Since coach-gut leveling fires only ~3–4 times in a child's NGA life, **badges
carry the felt sense of progress between level-ups.** Growth-only means they
replace the leaderboard entirely.

### Design principles
- **Age-inverted cadence.** Same four-family system, but the *mix and frequency shift by band*: frequent/small/automatic for 7U/10U, rare/scarce/status for 14U/16U. The meaning of a badge grows up alongside the kid — and the frequent young-kid badges are genuinely effort-based (which *is* what to reinforce at 6), so it never becomes a participation trophy.
- **Auto/coach split = the dopamine economy.** *Stats badges auto-award* from attendance + engine data (frequent, instant, cheap). *Values + milestone badges are coach-hand-picked* (scarce, weighty — the emotional value comes from a human deliberately choosing you, by name, in the debrief). This is Feedback Density turned into gamification.
- **Tiers (I / II / III)** on skill + some habit badges → depth for older kids without inventing infinite new badges (dilution-proof). Streaks reset when broken, so they carry real stakes.
- **Physical + digital.** A tangible **stamp "passport" booklet for 7U/10U** (magic for little kids, zero-tech, works in the Phase 0 paper pilot) + a **digital mirror in the parent/kid dashboard for all bands**. Teens lean digital/status.

### The four families
- **1 · Participation & Habit** *(auto, effort-based)* — First Session · streaks (3-in-a-row, **Perfect Season 8/8**) · **lifetime touch milestones (100/500/1000**, which rewards the exact thing the format maximizes) · **"Bounce-Back"** for returning after a missed week (anti-shame).
- **2 · Skill** *(tied 1:1 to checklist items; auto where the engine can measure it, coach where it can't; tiered I/II/III)* — "Rally Keeper," "Third-Shot Drop," "Speed-Up," "Stack & Switch," etc. **Earning all skill badges in a level composes into that level-up milestone.**
- **3 · Values / EASE** *(coach-awarded, scarce — the soul of the program)* — **"Honest Call"** (Ethics: a call made against your own interest — the generosity rule lived) · **"Great Partner"** (Attitude) · **"Word of the Day"** (Skills) · **"Better Than Yesterday"** (Excellence). Handed out deliberately, by name, in the debrief; coach gives sparingly so they stay special.
- **4 · Milestone** *(rare, identity, ceremony)* — level-up · **Mentor** (16U, unlocks the role) · **Yellow-Ball Invite** · season-finale **"Most Improved" measured against the kid's *own* Week-1 baseline, never vs. other kids** (growth-only even in the trophy).

### Cadence by band (what the badge "diet" looks like)
| Band | Dominant families | Roughly how often | Format |
|---|---|---|---|
| **7U** | Participation + simple Skill + Values callouts | something most sessions | physical passport stamps + digital |
| **10U** | Skill-heavy (acquisition years) + Values | ~every 1–2 sessions | passport + digital |
| **14U** | Skill mastery (tiers) + Values + Mentor-track | rarer, clearly earned | digital (passport optional) |
| **16U** | Milestone / leadership + skill tiers + values | rare, status-weighted | digital |

*Guard for the teens:* keep some regular signal for 16U (skill tiers, touch
milestones, values callouts) so they're never in a months-long badge desert
between rare milestones.

## Senior mentor role (16U; strong 14U by exception)
- **Earned, not automatic:** a coach-confirmed **Mentor badge** gated on EASE values + attendance reliability + skill level. Confers status/identity for teens.
- **What they do:** assist on a 7U/10U court — feed balls, run a drill station, model a skill, encourage, help with targets/score. **Not disciplinary.**
- **Safeguarding (non-negotiable, launch blocker):** always under direct coach line-of-sight; **never 1:1 unsupervised**; no transport; parental consent on file; age-appropriate vetting before the role is granted. Mentor conduct held to the highest EASE bar.
- **Why it's worth the scheduling overlap:** Active-Heart-Rate win, coach-ratio relief, near-peer heroes for little kids, teen retention, and a staffing pipeline (mentor → aged-out assistant → paid coach).
- **Cost accepted:** 7U/10U and 14U/16U sessions must share a time/venue window (or mentors arrive early/stay late).

---

## Conduct & Safety Code
Grounded in **EASE**, so a conduct slip is an *Ethics*/*Attitude* coaching
moment, not an arbitrary rule broken. **Restorative for kids; a warm norm for parents.**

**A. Line calls & honesty (Ethics)**
- Call your own side only (the foundation of self-officiating).
- **Generosity rule — "when in doubt, it's IN"** — any uncertainty goes to the opponent. Dissolves most disputes; it *is* the Ethics value made physical.
- Never call the other team's side.

**B. Dispute resolution (age-scaled, kid-owned)** — coach trains the *process*, not the verdict:
1. Generosity first (most disputes end here).
2. Genuine stalemate → **Rock-Paper-Scissors for the point** (fast, fun, face-saving). Replay-the-point is the gentle alternative for the youngest.
3. Coach is last resort, and coaches the habit.
- **Scaling:** 7U coach/mentor helps name the call · 10U kids RPS it · 14U/16U full self-officiation (ties to the Yellow-ready checklist).

**C. Sportsmanship (Attitude)**
- Compete hard, stay kind; encourage partner *and* opponents (today's opponent is next round's teammate).
- No arguing calls, gloating, or put-downs (of others *or* self).
- Paddle-tap / "good games" every rotation.
- Restorative enforcement: slip → in-the-moment EASE coaching; repeated/serious → sit a rotation + calm talk + loop in parent.

**D. Physical safety**
- The slow ball *is* a safety rule for 7U (no hard drives at faces by design).
- Paddle down when walking; no swinging near others; "**ball on!**" stops any court a stray ball enters.
- Heat & hydration (outdoor MoCo summers): scheduled water breaks, shade, watch for overheating.
- **Eyewear required for every player, every band, every session** (universal = no court-side judgment call). Court shoes required; age-appropriate paddle weight for little kids.
- Injury protocol: stop play → coach assesses → first-aid kit on site → emergency contact on file → written emergency action plan per venue.

**E. Mentor safeguarding** — see the mentor role above; treat as a launch blocker.

**F. Parent / sideline code (supportive, not critical) — warm norm, no formal teeth**
- Communicated at registration as "here's how we cheer at NGA," reinforced by coach modeling + cohort culture, with gentle 1:1 reminders. No strike/removal ladder.
- Cheer effort + sportsmanship; **don't coach, referee, or critique from the sideline** (calls belong to kids/coach).
- Cheer *every* kid, not just your own. Car-ride-home rule: lead with *"I love watching you play."* No photographing other families' kids without consent.
- **Accepted risk:** a persistently critical parent can still erode the environment; mitigation leans on culture + early private coach conversation. Revisit only if it becomes a real problem.

---

## What already exists (cross-repo inventory)

**`community-os` — engine + competitive spine (build home)**
- `packages/tournament`: format registry (`FormatModule`, variants rp/sp/adaptive); round-robin generators; **curated `rp_04`…`rp_18`** (rp_04 = 4 players, 6 rounds, every pair twice — maps 1:1 onto NGA's 4-per-court cap); `standings()` per player.
- `apps/p3`: live runner (`p3.linkanddink.com`) — score entry, per-format client, **Twilio SMS agent** (`start`/`lock`/`status`) for no-app courtside scoring.
- Ladder/leaderboard exist but **are deliberately NOT surfaced** (growth-only).

**`nga-coaching-system` — values + curriculum (private)**
- EASE; the two Pillars; the **shared-vocabulary CSV** (L1/L2, categories Methodology/Gameplay/Control/Power/Positioning, terms like Reset-From-Transition, Speed-Up, Shake-and-Bake, Stack-and-Switch Signals) → the **skill-stamp catalogue**; the "block" structure; tagline *"Better than yesterday — together."*

**`nextgen-academy` (this repo) — families, ops, money, attendance**
- Sessions (`notion-sessions.ts`), registrations + Stripe + **Attendance** select (`notion-dropins.ts`), coach dashboard with day-of check-in + family profiles (`player-profiles.ts`, family keyed on parent email), **Open Brain ingest** with arbitrary metadata (attendance already lands as `nga_attendance`). Guardrails: `verify-funnel.mjs` (no pixels, Yellow Ball invite-only).

**Bottom line:** competitive plumbing exists in `community-os`; values+curriculum in `nga-coaching-system`; families+attendance+payments here. The league is mostly **integration + a growth layer**, not green-field.

---

## Architecture & data model

```
community-os  (BUILD HOME)
  ├─ packages/tournament   → reuse rp_04 scheduler + standings
  ├─ apps/p3               → reuse score entry + SMS agent
  └─ apps/<league> (new)   → seasons, per-child growth record, badges,
                             parent growth view, coach run-sheet/objectives
        ↑ reads coaching content from nga-coaching-system (vocab, drill cards)
        ↑ reads roster/attendance/payments from NGA Notion / Open Brain
nextgen-academy  → marketing + enrollment + attendance; links out; keeps guardrails
```

**New tables (community-os / Supabase):** `league_season` · `league_enrollment`
(child ↔ season) · `session_block` (objective, Word-of-the-Day, drill refs) ·
`player_session_stat` (the growth feed from engine standings) · `skill_stamp` /
`child_skill` · `level_progression` (coach-confirmed).

**The crux — child identity join:** community-os' identity spine must map a
`child` across NGA Notion rows, Open Brain profiles, and engine `playerId`s.
Reuse NGA's parent-email family key (`encodeParentKey`) as the join.

---

## Phased build plan (executed in community-os)
- **Phase 0 — paper pilot (no code):** run one band on the all-levels Tuesday using the existing P3 app for `rp_04` + a manual growth sheet. Validate the routine + the "parents want the growth curve" hypothesis.
- **Phase 1 — growth record:** identity join + `player_session_stat` from standings; minimal parent growth view; skill stamps from vocab.
- **Phase 2 — coach run-sheet:** block plan, Word-of-the-Day, drill cards, `rp_04` auto-setup; confirm courtside score entry.
- **Phase 3 — enrollment + comms:** season enrollment bridged from NGA; EASE-framed growth-digest email; level-up + badge celebrations.
- **Phase 4 — NGA surfacing:** a `/league` page (dark theme, JsonLd, price teased) linking out; must pass `verify-funnel.mjs`.

---

## Open items / next decisions
**Design:** the league is now designed end-to-end (values, banding, season, format, leveling, checklists, mentor role, conduct & safety, badges). Remaining badge work is fine-grained, not structural: finalize the exact per-band badge list + names (reconcile skill badges to the vocab CSV) and the passport print design.

**Curriculum:**
- Reconcile every checklist item to the live shared-vocabulary CSV (exact names + L1/L2).
- Calibrate the illustrative anchors with a coach's eye (is a 6-ball rally right for Red→Orange? are the drop hit-rates realistic? is 10U too early for the Kid-Coach reffing role?).

**Ops:**
- **Pricing / commitment** for a fixed-roster season (vs. current $20 drop-in). Honor NGA's "price teased, not quoted" rule publicly until a real Stripe product exists.
- Per-venue emergency action plan + first-aid/AED on site + coach first-aid/CPR certification.
- Pilot scope: which single band launches first.

**Build (community-os):**
- Is the identity spine ready to be the child join key, or do we bridge via Open Brain in the interim?
- Confirm SMS agent vs. live client as the v1 courtside path.
- *Blocker for this repo's tools:* `community-os` / `nga-coaching-system` aren't in this session's GitHub scope (and `list_repos`/`add_repo` weren't available), so the vocab CSV couldn't be pulled live and no engine code was read directly.

---

## Verification (once built, in community-os)
- **Engine:** `rp_04` has run-file + e2e tests; a 4-kid court must produce 6 rounds / 6 games each, every pair twice.
- **Growth feed:** a completed pilot session produces one `player_session_stat` per attending child (non-null touches/games); the parent view renders *only* that child (no peer data leak).
- **Identity:** one real family resolves to the same child across an NGA Notion registration, an Open Brain `nga_attendance` activity, and an engine `playerId`.
- **NGA side (Phase 4):** `npm run build` clean; `node scripts/verify-funnel.mjs` passes; price teased, not quoted.
