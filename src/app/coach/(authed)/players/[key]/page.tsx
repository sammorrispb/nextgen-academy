import Link from "next/link";
import { notFound } from "next/navigation";
import { getFamilyProfile } from "@/lib/player-profiles";
import BracketAssign from "./BracketAssign";

export const dynamic = "force-dynamic";

function formatDate(date: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function age(birthYear: number): string {
  if (!birthYear) return "";
  return `age ${new Date().getFullYear() - birthYear}`;
}

interface PageProps {
  params: Promise<{ key: string }>;
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { key } = await params;
  const profile = await getFamilyProfile(key);
  if (!profile) notFound();

  const net = profile.paidUsd; // currently-held payments (refunds already excluded)

  return (
    <>
      <Link
        href="/coach/players"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All families
      </Link>

      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-1">
        {profile.parentName || "Family"}
      </h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ngpa-white/70 mb-8">
        {profile.parentEmail && (
          <a href={`mailto:${profile.parentEmail}`} className="text-ngpa-teal hover:underline">
            {profile.parentEmail}
          </a>
        )}
        {profile.parentPhone && (
          <a
            href={`sms:${profile.parentPhone.replace(/\D/g, "")}`}
            className="hover:text-ngpa-teal"
          >
            {profile.parentPhone}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
        <Stat label="Registrations" value={String(profile.lifetimeRegistrations)} />
        <Stat label="Attended" value={String(profile.attended)} tone="good" />
        <Stat label="No-shows" value={String(profile.noShow)} tone={profile.noShow > 0 ? "bad" : undefined} />
        <Stat label="Paid (held)" value={`$${net.toFixed(0)}`} />
        <Stat label="Refunded" value={`$${profile.refundedUsd.toFixed(0)}`} />
      </div>

      <div className="space-y-8">
        {profile.children.map((child) => (
          <section key={child.childFirstName}>
            <div className="flex items-baseline gap-3 mb-2">
              <h2 className="font-heading text-xl font-black text-ngpa-white">
                {child.childFirstName}
              </h2>
              <span className="text-xs text-ngpa-white/55">
                {age(child.birthYear)}
                {age(child.birthYear) ? " · " : ""}
                {child.attended} attended · {child.noShow} no-show
              </span>
            </div>

            <div className="mb-3">
              <BracketAssign
                parentEmail={profile.parentEmail}
                parentPhone={profile.parentPhone}
                parentName={profile.parentName}
                childFirstName={child.childFirstName}
                level={child.level}
              />
            </div>

            {/* Horizontal scroll so the full table is reachable on a phone
                rather than clipped at the right edge. */}
            <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
                  <tr>
                    <th className="text-left font-bold px-4 py-3">Session</th>
                    <th className="text-left font-bold px-4 py-3">Location</th>
                    <th className="text-center font-bold px-4 py-3">Attendance</th>
                    <th className="text-right font-bold px-4 py-3">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ngpa-slate/40">
                  {child.events.map((e, i) => (
                    <tr key={`${e.sessionDate}-${i}`} className="hover:bg-ngpa-deep/30">
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <p className="text-ngpa-white/90 font-bold">{e.sessionTitle || "—"}</p>
                        <p className="text-xs text-ngpa-white/55">{formatDate(e.sessionDate)}</p>
                        {e.status !== "Confirmed" && (
                          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-ngpa-white/55">
                            {e.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-ngpa-white/70 whitespace-nowrap">
                        {e.location?.split(",")[0] || "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        <AttendancePill value={e.attendance} />
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono text-ngpa-white/85">
                        {e.refunded ? (
                          <span className="text-ngpa-white/45 line-through">${e.amountUsd.toFixed(0)}</span>
                        ) : (
                          `$${e.amountUsd.toFixed(0)}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const valueColor =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? "text-red-300"
        : "text-ngpa-white";
  return (
    <div className="rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 px-4 py-3">
      <p className={`font-heading text-2xl font-black ${valueColor}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-ngpa-white/55 mt-0.5">{label}</p>
    </div>
  );
}

function AttendancePill({ value }: { value: "Present" | "No-show" | "" }) {
  if (value === "Present") {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
        ✓ Here
      </span>
    );
  }
  if (value === "No-show") {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/50">
        No-show
      </span>
    );
  }
  return <span className="text-ngpa-white/35 text-xs">—</span>;
}
