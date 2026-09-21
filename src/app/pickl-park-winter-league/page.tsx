import type { Metadata } from "next";
import PicklParkWinterLeagueForm from "@/components/PicklParkWinterLeagueForm";
import {
  PICKL_PARK_WINTER_LEAGUE_PRICE_USD,
  PICKL_PARK_WINTER_LEAGUE_PUBLIC_AREA,
  PICKL_PARK_WINTER_LEAGUE_SATURDAYS,
  PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL,
  PICKL_PARK_WINTER_LEAGUE_SESSIONS,
  PICKL_PARK_WINTER_LEAGUE_TITLE,
  PICKL_PARK_WINTER_LEAGUE_TRACKS,
  PICKL_PARK_WINTER_LEAGUE_VENUE,
  PICKL_PARK_WINTER_LEAGUE_VENUE_SHORT,
} from "@/data/pickl-park-winter-league-2026";

// The Winter Youth League registration page — NGA-sold on the NGA site
// (invoice-based checkout, Sam 2026-09-21), co-branded with The Pickl Park
// (Amar signed off 2026-09-21).
//
// INDEXED, deliberately — the opposite call from /monday-girls. This is a
// public campaign for a commercial facility: Frederick parents should find
// "youth pickleball league Frederick MD" in search. The venue's public
// business address belongs on this page; it is not a child-safety exposure.
//
// Distinct from the retired Pickl Park fall Saturday (which The Pickl Park
// sells through PodPlay) — nothing here may point at those listings or their
// prices.

export const metadata: Metadata = {
  title: `Winter Youth Pickleball League — ${PICKL_PARK_WINTER_LEAGUE_PUBLIC_AREA}`,
  description: `Next Gen Pickleball Academy's ${PICKL_PARK_WINTER_LEAGUE_TITLE} at ${PICKL_PARK_WINTER_LEAGUE_VENUE_SHORT} in ${PICKL_PARK_WINTER_LEAGUE_PUBLIC_AREA}: 6 Saturday sessions ${PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL} — Foundations for 10U learning the game, Game Time for ages 11–14 who want to play. $${PICKL_PARK_WINTER_LEAGUE_PRICE_USD} for the season.`,
  alternates: { canonical: "https://nextgenpbacademy.com/pickl-park-winter-league" },
};

const MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

function saturdayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", MONTH_DAY);
}

export default function PicklParkWinterLeaguePage() {
  return (
    <main className="bg-ngpa-navy min-h-screen">
      {/* Hero */}
      <section className="px-5 sm:px-8 pt-16 pb-10 max-w-3xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          Frederick, MD · Indoors at {PICKL_PARK_WINTER_LEAGUE_VENUE_SHORT}
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          {PICKL_PARK_WINTER_LEAGUE_TITLE}
        </h1>
        <p className="text-ngpa-white/80 text-lg mt-4">
          Two ways to play this winter — one for kids learning the game, one
          for kids who want to play it. Six Saturday sessions,{" "}
          <time dateTime={PICKL_PARK_WINTER_LEAGUE_SATURDAYS[0]}>
            {PICKL_PARK_WINTER_LEAGUE_SEASON_LABEL}
          </time>
          , coached by Next Gen Pickleball Academy.
        </p>
      </section>

      {/* The two tracks */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PICKL_PARK_WINTER_LEAGUE_TRACKS.map((track) => (
            <div
              key={track.track}
              className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60"
            >
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-teal-bright">
                {track.ageLabel}
              </p>
              <h2 className="font-heading text-xl font-black text-ngpa-white mt-1">
                {track.label}
              </h2>
              <p className="text-ngpa-white/80 font-bold text-sm mt-1">
                {track.timeLabel}
              </p>
              <p className="text-ngpa-white/70 text-sm mt-2">{track.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* At a glance */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              When
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              Saturdays
            </p>
            <p className="text-ngpa-white/70 text-sm">
              10U: 2:00–3:00 PM · 11–14: 3:00–4:30 PM
            </p>
          </div>
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              Where
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              {PICKL_PARK_WINTER_LEAGUE_VENUE_SHORT}
            </p>
            <p className="text-ngpa-white/70 text-sm">
              {PICKL_PARK_WINTER_LEAGUE_VENUE} — indoors, so weather never
              cancels a session
            </p>
          </div>
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              Cost
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              ${PICKL_PARK_WINTER_LEAGUE_PRICE_USD}
            </p>
            <p className="text-ngpa-white/70 text-sm">
              All {PICKL_PARK_WINTER_LEAGUE_SESSIONS} sessions, paid up front —
              $37.50 a session
            </p>
          </div>
        </div>
      </section>

      {/* Dates */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <h2 className="font-heading text-2xl font-black text-ngpa-white">
          The {PICKL_PARK_WINTER_LEAGUE_SESSIONS} Saturdays
        </h2>
        <ul className="mt-4 space-y-2">
          {PICKL_PARK_WINTER_LEAGUE_SATURDAYS.map((iso) => (
            <li
              key={iso}
              className="flex items-center gap-3 rounded-xl px-4 py-3 border text-ngpa-white/85 bg-ngpa-panel/60 border-ngpa-slate/40"
            >
              <span className="h-2 w-2 rounded-full shrink-0 bg-ngpa-teal" />
              <time dateTime={iso}>{saturdayLabel(iso)}</time>
            </li>
          ))}
        </ul>
        <p className="text-ngpa-white/60 text-sm mt-3">
          Yes, that includes Halloween — costumes on court are welcome, candy
          after. We&rsquo;re indoors, so every Saturday runs. Bring a refillable
          water bottle and court shoes; we have loaner paddles.
        </p>
      </section>

      {/* Register */}
      <section
        id="register"
        className="px-5 sm:px-8 pb-20 max-w-2xl mx-auto scroll-mt-24"
      >
        <h2 className="font-heading text-2xl font-black text-ngpa-white mb-5">
          Register — ${PICKL_PARK_WINTER_LEAGUE_PRICE_USD}
        </h2>
        <p className="text-ngpa-white/70 mb-6">
          Fill this in and we&rsquo;ll email you a $
          {PICKL_PARK_WINTER_LEAGUE_PRICE_USD} invoice — pay it online to lock
          your player&rsquo;s spot. Spots are limited so every kid gets real
          court time and coaching attention.
        </p>
        <PicklParkWinterLeagueForm />
      </section>
    </main>
  );
}
