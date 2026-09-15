import {
  FALL_SEASON_LABEL,
  FALL_SUNDAYS,
  FALL_VENUE_SHORT,
} from "@/data/fall-2026";
import {
  FALL_SEASON_GROUPS,
  fallSeasonSlotsFor,
  type FallSeasonGroup,
} from "@/data/fall-season-2026";
import { fetchFallRoster } from "@/lib/notion-fall-registrations";
import { requireAdmin } from "@/lib/require-admin";
import {
  buildFallGroupMailto,
  countConfirmedByGroup,
  toAdminFallPlayer,
  type AdminFallPlayer,
} from "@/lib/admin-fall-roster";

// The Walter Johnson Sunday season roster. /coach/fall-season reads the same
// registrations but narrowed to an id and a first name, because it runs the
// Sundays; this is the money-and-registrations view, mirroring
// /admin/monday-girls.
//
// Read-only by design: a refund is a deliberate act through the existing
// /api/cancel-fall-registration path or the Stripe Dashboard, and
// `charge.refunded` reconciles the row. This page shows; it does not move money.
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
  if (status === "Refunded" || status === "Cancelled")
    return "bg-ngpa-red/15 text-ngpa-red border-ngpa-red/40";
  return "bg-ngpa-slate/40 text-ngpa-white/60 border-ngpa-slate/60";
}

export default async function AdminFallPage() {
  // Gate FIRST, before any read. The (authed) layout alone is not enough: a
  // layout and its page render concurrently, so a layout-only redirect still
  // let /admin/monday-girls fetch its roster and ship it inside the 307's body
  // (2026-09-15, a live leak). This page server-renders child PII too. See
  // src/lib/require-admin.ts.
  await requireAdmin();

  const result = await fetchFallRoster();
  const players = result.status === "ok" ? result.rows.map(toAdminFallPlayer) : [];

  const knownGroups = FALL_SEASON_GROUPS.map((g) => g.group as string);
  // A row whose Group select is blank or typo'd belongs to no section — show it
  // rather than letting it vanish from the one place an operator counts seats.
  const unplaced = players.filter((p) => !knownGroups.includes(p.group));

  const registrationOpen =
    process.env.NEXT_PUBLIC_FALL_REGISTRATION_OPEN === "true" &&
    new Date().toISOString().slice(0, 10) <= FALL_SUNDAYS[FALL_SUNDAYS.length - 1];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-black">Fall season</h1>
        <p className="text-ngpa-white/65 text-sm mt-1">
          Sundays at {FALL_VENUE_SHORT} · {FALL_SEASON_LABEL} ·{" "}
          {registrationOpen ? "Registration open" : "Registration closed"}
        </p>
      </div>

      {result.status === "config_missing" ? (
        <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 text-sm text-ngpa-white/70">
          <b className="text-ngpa-white">Roster database isn&rsquo;t configured.</b> Set{" "}
          <code className="font-mono text-ngpa-teal">NOTION_FALL_REGS_DB_ID</code> and make
          sure the DB is shared with the &ldquo;Player DB&rdquo; Notion integration.
        </div>
      ) : result.status === "query_failed" ? (
        <div className="rounded-xl border border-ngpa-red/40 bg-ngpa-red/10 p-4 text-sm text-ngpa-red">
          <b>Couldn&rsquo;t read the roster.</b> {result.message} — this is a read failure,{" "}
          <em>not</em> an empty roster. Don&rsquo;t treat it as &ldquo;nobody
          registered&rdquo;; reload, and check the Notion integration if it persists.
        </div>
      ) : (
        <div className="space-y-10">
          {FALL_SEASON_GROUPS.map((option) => (
            <GroupSection
              key={option.group}
              group={option.group}
              label={option.label}
              timeLabel={option.timeLabel}
              players={players}
            />
          ))}

          {unplaced.length > 0 && (
            <section>
              <h2 className="font-heading text-xl font-black mb-1">Not in a group</h2>
              <p className="text-ngpa-white/60 text-sm mb-4">
                {unplaced.length} row{unplaced.length === 1 ? "" : "s"} whose{" "}
                <code className="font-mono text-ngpa-teal">Group</code> doesn&rsquo;t match
                a season group — fix the select in Notion so the seat is counted.
              </p>
              <RosterTable players={unplaced} showGroup />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  group,
  label,
  timeLabel,
  players,
}: {
  group: FallSeasonGroup;
  label: string;
  timeLabel: string;
  players: AdminFallPlayer[];
}) {
  const mine = players.filter((p) => p.group === group);
  // Per group, never one shared number — Green holds 8 and Yellow 10.
  const capacity = fallSeasonSlotsFor(group);
  const confirmed = countConfirmedByGroup(players, group);
  const collected = mine
    .filter((p) => p.status === "Confirmed")
    .reduce((sum, p) => sum + p.amountPaidUsd, 0);
  const mailto = buildFallGroupMailto(players, group);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-heading text-xl sm:text-2xl font-black">{label}</h2>
          <p className="text-ngpa-white/60 text-sm mt-0.5">{timeLabel}</p>
        </div>
        {mailto ? (
          <a
            href={mailto}
            className="inline-flex items-center px-4 py-2.5 min-h-[44px] rounded-full border border-ngpa-slate/60 font-heading text-xs font-bold hover:border-ngpa-teal hover:text-ngpa-teal transition-colors"
          >
            Email these families
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Tile label="Registered" value={`${confirmed} / ${capacity}`} />
        <Tile label="Seats left" value={String(Math.max(0, capacity - confirmed))} />
        <Tile label="Collected" value={`$${collected}`} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 text-sm text-ngpa-white/70">
          No registrations yet in {label}. The roster read succeeded — this really is
          empty.
        </div>
      ) : (
        <RosterTable players={mine} />
      )}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ngpa-slate/50 bg-ngpa-panel/50 p-4">
      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-ngpa-white/45">
        {label}
      </p>
      <p className="font-mono text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function RosterTable({
  players,
  showGroup = false,
}: {
  players: AdminFallPlayer[];
  showGroup?: boolean;
}) {
  const headers = [
    "Player",
    "Born",
    ...(showGroup ? ["Group"] : []),
    "Parent",
    "Contact",
    "Status",
    "Paid",
    "Registered",
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-ngpa-slate/50">
      <table className="w-full text-sm min-w-[44rem]">
        <thead>
          <tr className="bg-ngpa-panel/60 text-left">
            {headers.map((h) => (
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
            <tr key={p.pageId} className="border-t border-ngpa-slate/30 align-top">
              <td className="px-3 py-3 font-heading font-bold whitespace-nowrap">
                {p.childFirstName || "—"}
              </td>
              <td className="px-3 py-3 font-mono tabular-nums text-ngpa-white/70">
                {p.childBirthYear ?? "—"}
              </td>
              {showGroup ? (
                <td className="px-3 py-3 text-ngpa-white/70 whitespace-nowrap">
                  {p.group || "—"}
                </td>
              ) : null}
              <td className="px-3 py-3 whitespace-nowrap">{p.parentName || "—"}</td>
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
                    <a href={`tel:${p.parentPhone}`} className="hover:text-ngpa-teal">
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
              <td className="px-3 py-3 font-mono tabular-nums text-ngpa-white/70 whitespace-nowrap">
                {prettyDate(p.registeredOnIso)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
