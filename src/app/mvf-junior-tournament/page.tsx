import type { Metadata } from "next";
import MvfJuniorTournamentForm from "@/components/MvfJuniorTournamentForm";
import {
  GUARANTEED_GAMES_TEXT,
  MEDALS_TEXT,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
  MVF_JUNIOR_TOURNAMENT_DIVISIONS,
  MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA,
  MVF_JUNIOR_TOURNAMENT_TIME_LABEL,
  MVF_JUNIOR_TOURNAMENT_TITLE,
  MVF_JUNIOR_TOURNAMENT_VENUE,
  NONRESIDENT_PRICE_USD,
  NO_REFUNDS_TEXT,
  RAIN_OR_SHINE_TEXT,
  RESIDENT_PRICE_USD,
} from "@/data/mvf-junior-tournament-2026";

// The MVF Junior Tournament registration page — NGA-sold on the NGA site
// (invoice-based checkout, Sam 2026-09-22), run at Apple Ridge Courts in
// Montgomery Village. Revenue splits 80/20 NGA/MVF (metadata-tracked,
// remitted manually).
//
// INDEXED, deliberately — the opposite call from /monday-girls. This is a
// public tournament at a public commercial facility: Montgomery Village
// parents should find "youth pickleball tournament Montgomery Village" in
// search. The venue is a public facility, not a child-safety exposure.

export const metadata: Metadata = {
  title: `Junior Pickleball Tournament — ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}`,
  description: `Next Gen Pickleball Academy's ${MVF_JUNIOR_TOURNAMENT_TITLE} at ${MVF_JUNIOR_TOURNAMENT_VENUE} in ${MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA}: ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}, ${MVF_JUNIOR_TOURNAMENT_TIME_LABEL}. Rotating partner round robin, ${GUARANTEED_GAMES_TEXT.toLowerCase()} ${MEDALS_TEXT.toLowerCase()} $${RESIDENT_PRICE_USD} resident / $${NONRESIDENT_PRICE_USD} non-resident.`,
  alternates: { canonical: "https://nextgenpbacademy.com/mvf-junior-tournament" },
};

export default function MvfJuniorTournamentPage() {
  return (
    <main className="bg-ngpa-navy min-h-screen">
      {/* Hero */}
      <section className="px-5 sm:px-8 pt-16 pb-10 max-w-3xl mx-auto">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-ngpa-teal-bright">
          {MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA} · At {MVF_JUNIOR_TOURNAMENT_VENUE}
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-ngpa-white mt-3 leading-tight">
          {MVF_JUNIOR_TOURNAMENT_TITLE}
        </h1>
        <p className="text-ngpa-white/80 text-lg mt-4">
          A one-day junior tournament: rotating partner round robin,{" "}
          {GUARANTEED_GAMES_TEXT.toLowerCase()}{" "}
          {MEDALS_TEXT.toLowerCase()} Coached by Next Gen Pickleball Academy.
        </p>
      </section>

      {/* The two divisions */}
      <section className="px-5 sm:px-8 pb-10 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MVF_JUNIOR_TOURNAMENT_DIVISIONS.map((division) => (
            <div
              key={division.division}
              className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate/60"
            >
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-teal-bright">
                {division.ageLabel}
              </p>
              <h2 className="font-heading text-xl font-black text-ngpa-white mt-1">
                {division.label}
              </h2>
              <p className="text-ngpa-white/70 text-sm mt-2">{division.blurb}</p>
              <p className="text-ngpa-white/60 text-sm mt-2">
                Min 6 players to run · max 12
              </p>
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
              {MVF_JUNIOR_TOURNAMENT_DATE_LABEL}
            </p>
            <p className="text-ngpa-white/70 text-sm">
              {MVF_JUNIOR_TOURNAMENT_TIME_LABEL}
            </p>
          </div>
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              Where
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              {MVF_JUNIOR_TOURNAMENT_VENUE}
            </p>
            <p className="text-ngpa-white/70 text-sm">
              {MVF_JUNIOR_TOURNAMENT_PUBLIC_AREA} · {RAIN_OR_SHINE_TEXT}
            </p>
          </div>
          <div className="bg-ngpa-panel rounded-2xl p-5 border border-ngpa-slate/60">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-white/50">
              Cost
            </p>
            <p className="font-heading text-lg font-black text-ngpa-white mt-1">
              ${RESIDENT_PRICE_USD} / ${NONRESIDENT_PRICE_USD}
            </p>
            <p className="text-ngpa-white/70 text-sm">
              Per player — resident / non-resident. {NO_REFUNDS_TEXT}
            </p>
          </div>
        </div>
      </section>

      {/* Register */}
      <section
        id="register"
        className="px-5 sm:px-8 pb-20 max-w-2xl mx-auto scroll-mt-24"
      >
        <h2 className="font-heading text-2xl font-black text-ngpa-white mb-5">
          Register — ${RESIDENT_PRICE_USD} resident / ${NONRESIDENT_PRICE_USD}{" "}
          non-resident
        </h2>
        <p className="text-ngpa-white/70 mb-6">
          Fill this in and we&rsquo;ll email you an invoice — pay it online to
          lock your player&rsquo;s spot. Each division is capped at 12 players.
        </p>
        <MvfJuniorTournamentForm />
      </section>
    </main>
  );
}
