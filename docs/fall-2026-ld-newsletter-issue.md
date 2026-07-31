# Fall 2026 survey — the Link & Dink half of the campaign

The NGA half sends itself: `POST /api/fall-survey?secret=$NGA_ADMIN_SECRET` with
`{"variant":"nga"}`. The **Link & Dink half ships no code** — the community-os
newsletter pipeline already does exactly what's needed, and routing around it
would be worse:

- `ld.enqueue_issue` targets every `ld.subscribers` row that is `subscribed`,
  has `confirmed_at` (double opt-in), and is not in `ld.suppressions`.
- The drain cron re-checks eligibility at send time and attaches
  `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058).

Blasting that list from the NGA repo would bypass all of it. So: paste, preview,
send.

> **Not `ld.players`.** That table has emails from RSVPs, but
> `event_invite_opt_in` defaults false and has never actually been collected —
> it is not a mailable list. `ld.subscribers` is the only compliant audience.

## Steps

1. Go to `https://www.linkanddink.com/admin/issues/new`.
2. **Title:** `Fall 2026 survey`
3. **Subject:** `Fall round robin at Wood MS — does this work for you?`
4. **Preview text:** `Sat + Sun, 5–7 PM, 8 weeks. Tell us before we book the courts.`
5. Paste the body below into the markdown editor.
6. **Test send** to Sam first — click the `/fall` link and the unsubscribe
   footer link in the received email before going further.
7. **Send.** The drain cron picks it up within a minute.

Send the NGA variant the same day so the two lists hear the same thing at the
same time.

---

## Body (paste from here down)

We're planning something for the fall and we'd rather ask than guess.

**Eight weeks at Earle B. Wood Middle School in Rockville — Saturdays and Sundays, 5:00–7:00 PM, September 12 through November 1.** Two programs running in the same window, so a family can come together and everybody plays.

### Link & Dink Fall Round Robin — adults

Two hours of rotating-partner round robin, grouped by bracket. No practice hour — you're playing the whole time. New, Rallying, Playing, Competing, Tournament Level.

Nine spots in each bracket.

### Next Gen Youth Fall Season — kids 6–16

Two hours: one hour of coached practice, then one hour of rotating-partner round robin, grouped by ball color. Red, Orange, Green, Yellow.

Nine spots in each color group.

If you've got a kid who plays, this is the one to look at — and you can be on the next court while they're on theirs.

### How it would work

**Nine spots per group, first come first serve.** Small on purpose — everybody gets real reps and real games.

**It's a full season.** You'd commit to all 8 weeks and pay for the season up front. That's what keeps a group together and keeps the round robin worth showing up for.

**Can't commit to all 8 weeks?** There's a sub list. Tell us and we'll call you when a spot opens week to week.

**We haven't set a price.** The form asks what a season like this would be worth to you. That's a real question, not a sales move.

### Tell us what works

Before we book the courts, we want to hear from you — whether the days work, which group you'd be in, whether a full season is realistic, and what it would be worth. It takes about a minute.

**[Tell us what works →](https://nextgenpbacademy.com/fall?utm_source=ld-newsletter&utm_medium=email&utm_campaign=fall-2026-survey)**

Filling this out doesn't hold a spot — there's nothing to register for yet. We're sizing real demand before we book the courts, and you'll hear from us first when it opens.

See you out there,
Sam
