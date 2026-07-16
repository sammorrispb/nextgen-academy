"use client";

import { trackEvent } from "@/lib/funnelClient";
import { MVF_TOURNAMENT } from "@/data/mvf";

/**
 * Cross-promo card for the Link & Dink tournament at Apple Ridge. Client
 * component so the outbound click fires `external_link` analytics, matching
 * the Footer's family-link convention.
 */
export default function MvfTournamentCard() {
  return (
    <a
      href={MVF_TOURNAMENT.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        trackEvent("external_link", {
          label: "mvf_tournament_linkanddink",
          url: MVF_TOURNAMENT.url,
          page: "mvf",
        })
      }
      className="group block rounded-2xl border border-ngpa-slate bg-ngpa-panel p-6 sm:p-7 hover:border-ngpa-teal transition-colors"
      data-testid="mvf-tournament-card"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
        Same courts &middot; Tournament day
      </p>
      <p className="font-heading text-xl sm:text-2xl font-bold text-ngpa-white mt-2">
        {MVF_TOURNAMENT.title}
      </p>
      <p className="text-sm text-ngpa-muted mt-2 leading-relaxed">
        <time dateTime={MVF_TOURNAMENT.date}>{MVF_TOURNAMENT.dateLabel}</time>,{" "}
        {MVF_TOURNAMENT.timeLabel} at Apple Ridge &middot; ages{" "}
        {MVF_TOURNAMENT.ageMin}+ &middot; {MVF_TOURNAMENT.format.toLowerCase()}{" "}
        &middot; {MVF_TOURNAMENT.brackets.join(" / ")} brackets. Rain date{" "}
        <time dateTime={MVF_TOURNAMENT.rainDate}>
          {MVF_TOURNAMENT.rainDateLabel}
        </time>
        .
      </p>
      <p className="font-mono font-bold text-ngpa-white mt-3">
        ${MVF_TOURNAMENT.prices[0].usd}
        <span className="text-ngpa-muted text-xs font-normal">
          {" "}
          resident
        </span>{" "}
        <span className="text-ngpa-muted" aria-hidden="true">
          &middot;
        </span>{" "}
        ${MVF_TOURNAMENT.prices[1].usd}
        <span className="text-ngpa-muted text-xs font-normal">
          {" "}
          non-resident, per player
        </span>
      </p>
      <span className="inline-flex items-center gap-1 mt-4 min-h-[48px] font-heading font-bold text-ngpa-teal group-hover:text-ngpa-teal-bright">
        See the tournament on Link &amp; Dink &rarr;
      </span>
    </a>
  );
}
