import type { Metadata } from "next";
import Link from "next/link";
import MondayGirlsRegistrationForm from "@/components/MondayGirlsRegistrationForm";
import {
  MONDAY_GIRLS_AGE_MAX,
  MONDAY_GIRLS_AGE_MIN,
  MONDAY_GIRLS_GROUP,
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_PEER_NOTE,
  MONDAY_GIRLS_PUBLIC_AREA,
  MONDAY_GIRLS_RAIN_DATES,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_SEASON_SESSIONS,
  MONDAY_GIRLS_SESSION_FORMAT,
  MONDAY_GIRLS_SKIPPED_DATE,
  MONDAY_GIRLS_SKIPPED_REASON,
  MONDAY_GIRLS_VENUE,
  MONDAY_GIRLS_VENUE_SHORT,
} from "@/data/monday-girls-2026";
import {
  MONDAY_GIRLS_SEASON_GROUP,
  MONDAY_GIRLS_SEASON_PRICE_USD,
  MONDAY_GIRLS_SEASON_TITLE,
} from "@/data/monday-girls-season-2026";
import {
  mondayGirlsRegistrationStateNow,
  mondayGirlsTodayET,
} from "@/lib/monday-girls-registration-window";
import {
  MONDAY_GIRLS_MIN_SESSIONS_SOLD,
  mondayGirlsIsProratedOn,
  mondayGirlsJoinPriceUsd,
  mondayGirlsRemainingMondays,
} from "@/lib/monday-girls-proration";
import { countMondayGirlsRegistrations } from "@/lib/notion-monday-girls-registrations";

// The Monday Girls Beginner Group registration page.
//
// NOINDEX, deliberately — this is NOT an SEO surface. Two reasons, either
// sufficient: (1) it is a campaign landing page for a block that was recruited
// by hand and holds four seats, so it must never compete with /schedule in
// search; (2) it publishes a precise recurring evening and a named middle
// school where a small group of identified young girls gathers. That is the
// same risk the Enrichment Collective clubs are kept off every public surface
// for. The page is reachable by anyone with the link — which is exactly the
// distribution this block needs — but search engines are not invited.
//
// For the same reason this block is deliberately ABSENT from /api/events/feed:
// the feed is public and unauthenticated, and a girls-only youth group's exact
// time and place does not belong in it. The Wood Monday hold is already on the
// Fall 2026 master schedule for calendar purposes.
//
// A real Stripe price backs /api/checkout-monday-girls, so quoting the price
// here is within the pricing rule — and the form does not render at all until
// that price exists (see monday-girls-registration-window.ts).

export const metadata: Metadata = {
  title: "Monday Girls Beginner Group — Register",
  description: `${MONDAY_GIRLS_SEASON_SESSIONS} Monday evenings of girls-only beginner youth pickleball at ${MONDAY_GIRLS_VENUE_SHORT} in ${MONDAY_GIRLS_PUBLIC_AREA}, ${MONDAY_GIRLS_SEASON_LABEL}. Small group, $${MONDAY_GIRLS_SEASON_PRICE_USD} per player for the full block.`,
  robots: { index: false, follow: false },
  alternates: { canonical: "https://nextgenpbacademy.com/monday-girls" },
};

export const revalidate = 300;

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

function mondayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

export default async function MondayGirlsPage() {
  const registrationState = mondayGirlsRegistrationStateNow();
  const registrationOpen = registrationState === "open";

  // Mid-season joining (Sam, 2026-09-14). A family arriving in week three buys
  // the Mondays that are left, at a price built from that same count — so the
  // number on this page, the number Stripe charges, and the dates in the
  // confirmation email are all the same arithmetic. `prorated` is false before
  // the block starts, where this page behaves exactly as it always did.
  const today = mondayGirlsTodayET();
  const prorated = mondayGirlsIsProratedOn(today);
  const joinMondays = mondayGirlsRemainingMondays(today);
  const joinPriceUsd = mondayGirlsJoinPriceUsd(today, MONDAY_GIRLS_SEASON_PRICE_USD);
  // Only read the roster when the form will actually render — a Notion call on
  // a closed page buys nothing. null = unknown, and the form hides the count
  // rather than showing a wrong one.
  const spotsTaken = registrationOpen
    ? await countMondayGirlsRegistrations(MONDAY_GIRLS_GROUP)
    : null;

  return (
    <main className="bg-ngpa-navy min-h-screen">
      {/* Hero */}
      <section className="px-5 sm:px-8 pt-16 pb-10 max-w-3xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          Girls only · Ages {MONDAY_GIRLS_AGE_MIN}&ndash;{MONDAY_GIRLS_AGE_MAX}{" "}
          · Beginner
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          {MONDAY_GIRLS_SEASON_TITLE}
        </h1>
        <p className="text-ngpa-white/80 text-lg mt-4">
          {MONDAY_GIRLS_SEASON_SESSIONS} Monday evenings at{" "}
          {MONDAY_GIRLS_VENUE_SHORT} in {MONDAY_GIRLS_PUBLIC_AREA} &mdash;{" "}
          <time dateTime={MONDAY_GIRLS_MONDAYS[0]}>
            {MONDAY_GIRLS_SEASON_LABEL}
          </time>
          , {MONDAY_GIRLS_SEASON_GROUP.timeLabel}.
        </p>
        <p className="text-ngpa-white/80 text-lg mt-4">
          {MONDAY_GIRLS_PEER_NOTE}
        </p>
      </section>

      {/* At a glance */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              When
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              Mondays
            </p>
            <p className="text-ngpa-white/70 text-sm">
              {MONDAY_GIRLS_SEASON_GROUP.timeLabel}
            </p>
          </div>
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              Where
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              {MONDAY_GIRLS_VENUE_SHORT}
            </p>
            <p className="text-ngpa-white/70 text-sm">{MONDAY_GIRLS_VENUE}</p>
          </div>
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              Cost
            </p>
            <p
              className="font-heading text-lg font-black text-ngpa-white mt-1"
              itemProp="price"
              content={String(joinPriceUsd)}
            >
              ${joinPriceUsd}
            </p>
            <p className="text-ngpa-white/70 text-sm">
              {prorated ? (
                <>
                  The {joinMondays.length} Mondays still to come &mdash; you only
                  pay for sessions your daughter will actually be at. The full{" "}
                  {MONDAY_GIRLS_SEASON_SESSIONS}-session block was $
                  {MONDAY_GIRLS_SEASON_PRICE_USD}.
                </>
              ) : (
                <>All {MONDAY_GIRLS_SEASON_SESSIONS} sessions, paid up front</>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Dates — with the skipped Monday named out loud */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">
          The {MONDAY_GIRLS_SEASON_SESSIONS} Mondays
        </h2>
        <ul className="mt-4 space-y-2">
          {MONDAY_GIRLS_MONDAYS.map((iso) => {
            const done = iso < today;
            return (
              <li
                key={iso}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  done
                    ? "text-ngpa-white/40 bg-ngpa-panel/30 border-ngpa-slate/20"
                    : "text-ngpa-white/85 bg-ngpa-panel/60 border-ngpa-slate/40"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    done ? "bg-ngpa-white/25" : "bg-ngpa-teal"
                  }`}
                />
                <time dateTime={iso}>{mondayLabel(iso)}</time>
                {done && (
                  <span className="text-xs uppercase tracking-widest font-heading ml-auto">
                    Already played
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {/* Said plainly rather than by quietly shortening the list: a parent
            should be able to see the whole block AND what they are buying. */}
        {prorated && joinMondays.length > 0 && (
          <div className="mt-4 rounded-xl border border-ngpa-teal/40 bg-ngpa-teal/10 px-4 py-3.5">
            <p className="text-ngpa-white/85 text-sm">
              <strong className="text-ngpa-white">
                The block is already under way &mdash; that&rsquo;s fine.
              </strong>{" "}
              Your daughter would join for the {joinMondays.length} Mondays from{" "}
              <time dateTime={joinMondays[0]}>{mondayLabel(joinMondays[0])}</time>{" "}
              onward, and you only pay for those. She will not be the only one
              learning something new: this is a beginner block and the girls are
              still early in it.
            </p>
          </div>
        )}
        {/* Named, not silently dropped: families recruited in August were told
            "Sept 14 – Oct 19", so the change has to be visible on the page they
            pay from. */}
        <div className="mt-4 rounded-xl border border-ngpa-orange/40 bg-ngpa-orange/10 px-4 py-3.5">
          <p className="text-ngpa-white/85 text-sm">
            <strong className="text-ngpa-white">
              We skip{" "}
              <time dateTime={MONDAY_GIRLS_SKIPPED_DATE}>
                {mondayLabel(MONDAY_GIRLS_SKIPPED_DATE)}
              </time>
              .
            </strong>{" "}
            {MONDAY_GIRLS_SKIPPED_REASON} If you heard &ldquo;September 14 to
            October 19&rdquo; from us earlier, this is why the block now ends a
            week later &mdash; you still get all{" "}
            {MONDAY_GIRLS_SEASON_SESSIONS} sessions.
          </p>
        </div>
        <p className="text-ngpa-white/60 text-sm mt-3">
          We&rsquo;re outdoors. If a Monday is rained out we make it up on{" "}
          {MONDAY_GIRLS_RAIN_DATES.map(mondayLabel).join(" or ")}.
        </p>
      </section>

      {/* What a session looks like */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">
          What an evening looks like
        </h2>
        <p className="text-ngpa-white/80 mt-3">
          Each Monday is a full hour &mdash; {MONDAY_GIRLS_SESSION_FORMAT}.
          It&rsquo;s a small group on one court, so every girl gets real
          coaching time each week instead of a place in a line.
        </p>
        <p className="text-ngpa-white/80 mt-3">
          Brand new to pickleball is exactly right for this block. Nobody is
          expected to arrive knowing how to serve, keep score, or rally &mdash;
          that&rsquo;s the point of the six weeks. Bring a refillable water
          bottle and court shoes; we have loaner paddles.
        </p>
      </section>

      {/* Register */}
      <section
        id="register"
        className="px-5 sm:px-8 pb-20 max-w-2xl mx-auto scroll-mt-24"
      >
        <h2 className="font-heading text-2xl font-black text-ngpa-white mb-5">
          Register
        </h2>
        {registrationOpen ? (
          <MondayGirlsRegistrationForm spotsTaken={spotsTaken} />
        ) : (
          <div className="bg-ngpa-panel/85 backdrop-blur rounded-2xl p-6 sm:p-8 border border-ngpa-slate/60 shadow-xl shadow-black/20 text-center">
            {/* Copy per REASON. One shared "the block is under way" message was
                wrong for two of the three closed states — it told a visitor
                arriving before launch that they had missed a block that had not
                started. */}
            <p className="font-heading text-lg font-black text-ngpa-white">
              {registrationState === "too_few_sessions"
                ? "Only a couple of Mondays left in this block"
                : "Sign-ups aren't open just yet"}
            </p>
            <p className="text-ngpa-white/70 text-sm mt-2">
              {registrationState === "too_few_sessions" ? (
                <>
                  We sell this block down to its last{" "}
                  {MONDAY_GIRLS_MIN_SESSIONS_SOLD} Mondays and then stop &mdash;
                  fewer than that isn&rsquo;t really a block, and the whole point
                  is a group that builds together week after week. If
                  you&rsquo;d still like your daughter on court, text Coach Sam
                  at{" "}
                  <a
                    href="tel:+13013254731"
                    className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                  >
                    301-325-4731
                  </a>{" "}
                  and he&rsquo;ll find her a session that fits &mdash; and tell
                  you when the next block starts.
                </>
              ) : (
                <>
                  We&rsquo;re putting the last pieces of this block in place.
                  Text Coach Sam at{" "}
                  <a
                    href="tel:+13013254731"
                    className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
                  >
                    301-325-4731
                  </a>{" "}
                  and he&rsquo;ll hold your daughter&rsquo;s spot &mdash;
                  there&rsquo;s room, and nothing below has changed.
                </>
              )}
            </p>
            <Link
              href="/schedule"
              className="inline-block mt-5 px-6 py-3 bg-ngpa-teal text-ngpa-deep font-heading font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              See what else is open &rarr;
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
