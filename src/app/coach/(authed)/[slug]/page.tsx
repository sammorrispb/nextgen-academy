import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchUpcomingSessions } from "@/lib/notion-sessions";
import { fetchUpcomingDropIns } from "@/lib/notion-dropins";
import { findSessionBySlug, sessionToSlug } from "@/lib/session-slug";

export const dynamic = "force-dynamic";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";

function formatLongDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ageFromBirthYear(birthYear: number): string {
  if (!birthYear) return "";
  const age = new Date().getFullYear() - birthYear;
  return `${age}, born ${birthYear}`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CoachSessionPage({ params }: PageProps) {
  const { slug } = await params;

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 60);

  const [sessions, drops] = await Promise.all([
    fetchUpcomingSessions(now),
    fetchUpcomingDropIns(isoDate(now), isoDate(end)),
  ]);

  const session = findSessionBySlug(sessions, slug);
  if (!session) notFound();

  const roster = drops.filter(
    (d) => d.sessionDate === session.date && d.sessionTitle === session.title,
  );

  const parentEmails = roster
    .map((r) => r.parentEmail)
    .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const mailtoSubject = encodeURIComponent(
    `Heads up — ${session.title} on ${formatLongDate(session.date)}`,
  );
  const mailtoBody = encodeURIComponent(
    `Hi parents,\n\nQuick note about ${session.title} on ${formatLongDate(session.date)} at ${session.startTime}${session.endTime ? `–${session.endTime}` : ""} (${session.location.split(",")[0]}).\n\n— Sam`,
  );
  const groupMailto =
    parentEmails.length > 0
      ? `mailto:?bcc=${parentEmails.join(",")}&subject=${mailtoSubject}&body=${mailtoBody}`
      : null;

  const publicShareUrl = `${SITE_ORIGIN}/schedule/${sessionToSlug(session)}`;

  return (
    <>
      <Link
        href="/coach"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All sessions
      </Link>

      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        {formatLongDate(session.date)} · {session.startTime}
        {session.endTime ? `–${session.endTime}` : ""}
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        {session.title}
      </h1>
      <p className="text-base text-ngpa-white/70 mb-8">{session.location}</p>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <span className="px-4 py-2 rounded-full bg-ngpa-panel border border-ngpa-slate/60 text-sm font-bold">
          <span className="text-ngpa-teal">{roster.length}</span>
          <span className="text-ngpa-white/60"> / {session.capacity}</span>{" "}
          reserved
        </span>
        {groupMailto && (
          <a
            href={groupMailto}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all min-h-[40px]"
          >
            Email all parents ({parentEmails.length})
          </a>
        )}
        <a
          href={publicShareUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-xs font-bold transition-colors min-h-[36px]"
        >
          View public page ↗
        </a>
      </div>

      {roster.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No reservations yet for this session.
        </div>
      ) : (
        <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
              <tr>
                <th className="text-left font-bold px-5 py-3">Child</th>
                <th className="text-left font-bold px-5 py-3">Parent</th>
                <th className="text-left font-bold px-5 py-3 hidden sm:table-cell">
                  Contact
                </th>
                <th className="text-right font-bold px-5 py-3">Paid</th>
                <th className="text-right font-bold px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ngpa-slate/40">
              {roster.map((r) => (
                <tr key={r.id} className="hover:bg-ngpa-deep/30">
                  <td className="px-5 py-4 align-top">
                    <p className="font-bold text-ngpa-white">
                      {r.childFirstName || "—"}
                    </p>
                    {r.childBirthYear > 0 && (
                      <p className="text-xs text-ngpa-white/55 mt-0.5">
                        age {ageFromBirthYear(r.childBirthYear)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top text-ngpa-white/85">
                    {r.parentName || "—"}
                  </td>
                  <td className="px-5 py-4 align-top text-xs hidden sm:table-cell">
                    {r.parentEmail && (
                      <a
                        href={`mailto:${r.parentEmail}`}
                        className="block text-ngpa-teal hover:underline truncate max-w-[14rem]"
                      >
                        {r.parentEmail}
                      </a>
                    )}
                    {r.parentPhone && (
                      <a
                        href={`sms:${r.parentPhone.replace(/\D/g, "")}`}
                        className="block text-ngpa-white/60 hover:text-ngpa-teal mt-0.5"
                      >
                        {r.parentPhone}
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top text-right font-mono text-ngpa-white/85">
                    ${r.amountPaidUsd.toFixed(0)}
                  </td>
                  <td className="px-5 py-4 align-top text-right">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Edit in Notion"
                      className="text-ngpa-white/55 hover:text-ngpa-teal transition-colors"
                    >
                      ↗
                    </a>
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
