import Link from "next/link";
import {
  MONDAY_GIRLS_GROUP,
  MONDAY_GIRLS_MONDAYS,
  MONDAY_GIRLS_SEASON_LABEL,
  MONDAY_GIRLS_VENUE_SHORT,
  mondayGirlsSlotsFor,
} from "@/data/monday-girls-2026";
import { MONDAY_GIRLS_SEASON_GROUP } from "@/data/monday-girls-season-2026";
import { fetchMondayGirlsRoster } from "@/lib/notion-monday-girls-registrations";
import {
  countConfirmed,
  toAdminMondayGirlsPlayer,
} from "@/lib/admin-monday-girls-roster";
import {
  mondayGirlsRegistrationStateNow,
  mondayGirlsTodayET,
} from "@/lib/monday-girls-registration-window";
import {
  mondayGirlsIsProratedOn,
  mondayGirlsJoinPriceUsd,
  mondayGirlsRemainingMondays,
} from "@/lib/monday-girls-proration";
import { MONDAY_GIRLS_SEASON_PRICE_USD } from "@/data/monday-girls-season-2026";

// The Monday Girls block roster. Every other season had an operator view and
// this one didn't — it was hand-recruited to four families, so Sam WAS the
// roster. Mid-season joining (2026-09-14) reopened registration for six weeks,
// which is what turned that into a gap worth closing.
//
// Read-only by design: there is no /api/cancel-monday-girls-registration route
// (see CLAUDE.md), so an NGA-side cancellation is still a deliberate act in the
// Stripe Dashboard. This page shows; it does not move money.
export const dynamic = "force-dynamic";

function prettyDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function statusPill(status: string): string {
  if (status === "Confirmed") return "bg-ngpa-lime/15 text-ngpa-lime border-ngpa-lime/40";
  if (status === "Refunded") return "bg-ngpa-red/15 text-ngpa-red border-ngpa-red/40";
  return "bg-ngpa-slate/40 text-ngpa-white/60 border-ngpa-slate/60";
}

export default async function AdminMondayGirlsPage() {
  const result = await fetchMondayGirlsRoster();
  const today = mondayGirlsTodayET();
  const capacity = mondayGirlsSlotsFor(MONDAY_GIRLS_GROUP);
  const gate = mondayGirlsRegistrationStateNow();
  const remaining = mondayGirlsRemainingMondays(today);
  const prorated = mondayGirlsIsProratedOn(today);
  const joinPrice = mondayGirlsJoinPriceUsd(today, MONDAY_GIRLS_SEASON_PRICE_USD);

  const players =
    result.status === "ok" ? result.rows.map(toAdminMondayGirlsPlayer) : [];
  const confirmed = countConfirmed(players);
  const collected = players
    .filter((p) => p.status === "Confirmed")
    .reduce((sum, p) => sum + p.amountPaidUsd, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-black">
          Monday Girls
        </h1>
        <p className="text-ngpa-white/65 text-sm mt-1">
          {MONDAY_GIRLS_SEASON_GROUP.label} · Mondays{" "}
          {MONDAY_GIRLS_SEASON_GROUP.timeLabel} at {MONDAY_GIRLS_VENUE_SHORT} ·{" "}
          {MONDAY_GIRLS_SEASON_LABEL}
        </p>
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-ngpa-slate/50 bg-ngpa-panel/50 p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-ngpa-white/45">
            Registered
          </p>
          <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {result.status === "ok" ? `${confirmed} / ${capacity}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-ngpa-slate/50 bg-ngpa-panel/50 p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-ngpa-white/45">
            Collected
          </p>
          <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {result.status === "ok" ? `$${collected}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-ngpa-slate/50 bg-ngpa-panel/50 p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-ngpa-white/45">
            Sessions left
          </p>
          <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {remaining.length} / {MONDAY_GIRLS_MONDAYS.length}
          </p>
        </div>
        <div className="rounded-xl border border-ngpa-slate/50 bg-ngpa-panel/50 p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-ngpa-white/45">
            Joining today
          </p>
          <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {gate === "open" ? `$${joinPrice}` : "Closed"}
          </p>
          <p className="text-[11px] text-ngpa-white/50 mt-1">
            {gate === "open"
              ? prorated
                ? `Prorated — ${remaining.length} sessions`
                : "Full block"
              : gate === "too_few_sessions"
                ? "Under the 3-session floor"
                : gate === "closed_by_flag"
                  ? "Kill switch is set"
                  : "Envs not set"}
          </p>
        </div>
      </div>

      {/* Roster */}
      {result.status === "config_missing" ? (
        <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 text-sm text-ngpa-white/70">
          <b className="text-ngpa-white">Roster database isn&rsquo;t configured.</b>{" "}
          Set <code className="font-mono text-ngpa-teal">NOTION_MONDAY_GIRLS_REGS_DB_ID</code>{" "}
          and make sure the DB is shared with the &ldquo;Player DB&rdquo; Notion
          integration.
        </div>
      ) : result.status === "query_failed" ? (
        <div className="rounded-xl border border-ngpa-red/40 bg-ngpa-red/10 p-4 text-sm text-ngpa-red">
          <b>Couldn&rsquo;t read the roster.</b> {result.message} — this is a read
          failure, <em>not</em> an empty roster. Don&rsquo;t treat it as
          &ldquo;nobody registered&rdquo;; reload, and check the Notion
          integration if it persists.
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 text-sm text-ngpa-white/70">
          No registrations yet. The roster read succeeded — this really is empty.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ngpa-slate/50">
          <table className="w-full text-sm min-w-[46rem]">
            <thead>
              <tr className="bg-ngpa-panel/60 text-left">
                {[
                  "Player",
                  "Born",
                  "Parent",
                  "Contact",
                  "Status",
                  "Paid",
                  "Sessions",
                  "Registered",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-ngpa-white/50 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.pageId}
                  className="border-t border-ngpa-slate/30 align-top"
                >
                  <td className="px-3 py-3 font-heading font-bold whitespace-nowrap">
                    {p.childFirstName || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums text-ngpa-white/70">
                    {p.childBirthYear ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {p.parentName || "—"}
                  </td>
                  <td className="px-3 py-3 text-ngpa-white/70">
                    {p.parentEmail ? (
                      <a
                        href={`mailto:${p.parentEmail}`}
                        className="text-ngpa-teal hover:text-ngpa-teal-bright underline break-all"
                      >
                        {p.parentEmail}
                      </a>
                    ) : null}
                    {p.parentPhone ? (
                      <div className="font-mono text-xs mt-0.5 tabular-nums">
                        <a
                          href={`tel:${p.parentPhone}`}
                          className="hover:text-ngpa-teal"
                        >
                          {p.parentPhone}
                        </a>
                        {p.smsConsent ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-ngpa-lime">
                            SMS ok
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusPill(p.status)}`}
                    >
                      {p.status || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums whitespace-nowrap">
                    ${p.amountPaidUsd}
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums whitespace-nowrap">
                    {p.sessionsPurchased}
                    {p.sessionsPurchased < MONDAY_GIRLS_MONDAYS.length ? (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wider text-ngpa-teal">
                        prorated
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums text-ngpa-white/70 whitespace-nowrap">
                    {prettyDate(p.registeredOnIso)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-ngpa-white/45 text-xs mt-5 leading-relaxed max-w-prose">
        Allergies and emergency contacts are recorded on each registration but
        are deliberately not shown here — this page manages registrations and
        money, and day-of safety fields belong on a coach view, the same split
        the camps roster uses. There is no cancel button because Monday Girls has
        no cancel route yet: refund in the Stripe Dashboard and the webhook
        reconciles this roster.{" "}
        <Link
          href="/admin/sessions"
          className="text-ngpa-teal hover:text-ngpa-teal-bright underline"
        >
          Back to sessions
        </Link>
      </p>
    </div>
  );
}
