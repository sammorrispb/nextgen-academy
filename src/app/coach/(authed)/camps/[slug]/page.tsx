import Link from "next/link";
import { notFound } from "next/navigation";
import { findCampBySlug, campDays } from "@/data/camps";
import { getStripe } from "@/lib/stripe";
import { collectPaidCampSessions } from "@/lib/notion-camp-roster";
import {
  toRosterView,
  type CampRosterViewEntry,
} from "@/lib/camp-roster-view";
import CampRosterPrint from "./CampRosterPrint";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Short weekday label for a camp morning, e.g. "Mon Jun 29". ISO + explicit UTC
// formatting so it never off-by-ones on Vercel's UTC build servers.
function formatCampDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function attendingLabel(row: CampRosterViewEntry, days: string[]): string {
  if (row.offWeek) return "Day not in this camp week";
  if (row.attendingDays.length === days.length) return "Full week";
  return row.attendingDays.map((i) => formatCampDay(days[i])).join(", ") || "—";
}

export default async function CoachCampRosterPage({ params }: PageProps) {
  const { slug } = await params;
  const camp = findCampBySlug(slug);
  if (!camp) notFound();

  const days = campDays(camp);

  let rows: CampRosterViewEntry[] = [];
  let stripeFailed = false;
  try {
    const stripe = getStripe();
    const { entries } = await collectPaidCampSessions(slug, stripe);
    rows = toRosterView(entries, camp, new Date().getUTCFullYear());
  } catch {
    stripeFailed = true;
  }

  return (
    <>
      <Link
        href="/coach/camps"
        className="print:hidden inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All camps
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
            {camp.weekLabel}
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
            {camp.title}
          </h1>
          <p className="text-base text-ngpa-white/70">
            {rows.length} camper{rows.length === 1 ? "" : "s"} ·{" "}
            {camp.exactLocation || camp.publicArea}
          </p>
        </div>
        <CampRosterPrint />
      </div>

      {stripeFailed ? (
        <div className="px-5 py-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-amber-200">
          Roster unavailable — Stripe not configured. Set{" "}
          <code className="font-mono">STRIPE_SECRET_KEY</code> to read live camp
          registrations.
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No paid registrations yet for this camp.
        </div>
      ) : (
        <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
              <tr>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Child</th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">
                  Allergies / medical
                </th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">
                  Emergency contact
                </th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">
                  Parent · Contact
                </th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">
                  Attending
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ngpa-slate/40">
              {rows.map((r) => (
                <tr key={r.stripeSessionId} className="align-top">
                  <td className="px-4 sm:px-5 py-4">
                    <p className="font-bold text-ngpa-white">
                      {r.childFirstName || "—"}
                    </p>
                    {r.age !== null && (
                      <p className="text-xs text-ngpa-white/55 mt-0.5">
                        age {r.age}
                      </p>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-4 max-w-[16rem]">
                    {r.allergies ? (
                      <>
                        <p className="text-ngpa-white/85 whitespace-pre-wrap break-words">
                          {r.allergies}
                        </p>
                        {r.allergiesTruncated && (
                          <p className="text-xs text-amber-300 mt-1">
                            (may be truncated — verify with parent)
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-ngpa-white/45">None noted</span>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-4 text-xs">
                    <p className="text-ngpa-white/85 font-bold text-sm">
                      {r.emergencyName || "—"}
                    </p>
                    {r.emergencyPhone && (
                      <p className="text-ngpa-white/70 mt-0.5 font-mono">
                        {r.emergencyPhone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-4 text-xs">
                    <p className="text-ngpa-white/85 font-bold text-sm">
                      {r.parentName || "—"}
                    </p>
                    {r.parentEmail && (
                      <a
                        href={`mailto:${r.parentEmail}`}
                        className="block text-ngpa-teal hover:underline truncate max-w-[14rem] mt-0.5 print:text-ngpa-white"
                      >
                        {r.parentEmail}
                      </a>
                    )}
                    {r.parentPhone && (
                      <a
                        href={`sms:${r.parentPhone.replace(/\D/g, "")}`}
                        className="block text-ngpa-white/70 hover:text-ngpa-teal mt-0.5 font-mono"
                      >
                        {r.parentPhone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-4 text-sm">
                    <span
                      className={
                        r.offWeek
                          ? "text-amber-300 font-bold"
                          : "text-ngpa-white/85"
                      }
                    >
                      {attendingLabel(r, days)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
