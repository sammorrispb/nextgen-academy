import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPollBySlug, fetchPollResponses } from "@/lib/notion-crew-polls";
import ConfirmCrewForm from "./ConfirmCrewForm";

export const dynamic = "force-dynamic";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function ageFromBirthYear(year: number): string {
  if (!year) return "—";
  return String(new Date().getFullYear() - year);
}

export default async function CoachPollDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const poll = await fetchPollBySlug(slug);
  if (!poll) notFound();

  const responses = await fetchPollResponses(poll.id);
  const yes = responses.filter((r) => r.vote === "Yes");
  const maybe = responses.filter((r) => r.vote === "Maybe");
  const no = responses.filter((r) => r.vote === "No");
  const publicUrl = `${SITE_ORIGIN}/poll/${poll.slug}`;

  return (
    <>
      <Link
        href="/coach/polls"
        className="inline-flex items-center gap-1 text-sm text-ngpa-white/70 hover:text-ngpa-teal mb-6 transition-colors"
      >
        ← All polls
      </Link>

      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        {poll.day} · {poll.startTime}
        {poll.endTime ? `–${poll.endTime}` : ""}
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        {poll.title}
      </h1>
      <p className="text-base text-ngpa-white/70 mb-6">
        {poll.location} {poll.level ? `· ${poll.level}` : ""} · Status:{" "}
        <span className="text-ngpa-teal font-bold">{poll.status}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <span className="px-4 py-2 rounded-full bg-ngpa-panel border border-ngpa-slate/60 text-sm font-bold">
          <span className="text-ngpa-teal">{yes.length}</span>
          <span className="text-ngpa-white/60"> / {poll.minPartySize} </span>
          yes
        </span>
        <span className="px-4 py-2 rounded-full bg-ngpa-panel border border-ngpa-slate/60 text-sm">
          {maybe.length} maybe
        </span>
        <span className="px-4 py-2 rounded-full bg-ngpa-panel border border-ngpa-slate/60 text-sm">
          {no.length} no
        </span>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-xs font-bold transition-colors min-h-[36px]"
        >
          View public poll ↗
        </a>
      </div>

      {responses.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70 mb-8">
          No votes yet. Share <code className="text-ngpa-teal">{publicUrl}</code> on WhatsApp.
        </div>
      ) : (
        <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ngpa-white/55 bg-ngpa-deep/40">
              <tr>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Child</th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Parent</th>
                <th className="text-left font-bold px-4 sm:px-5 py-3">Vote</th>
                <th className="text-left font-bold px-4 sm:px-5 py-3 hidden sm:table-cell">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ngpa-slate/40">
              {responses.map((r) => (
                <tr key={r.id} className="hover:bg-ngpa-deep/30">
                  <td className="px-4 sm:px-5 py-4 align-top">
                    <p className="font-bold text-ngpa-white">{r.childFirstName || "—"}</p>
                    <p className="text-xs text-ngpa-white/55 mt-0.5">
                      {r.childLevel || "?"} · age {ageFromBirthYear(r.childBirthYear)}
                    </p>
                  </td>
                  <td className="px-4 sm:px-5 py-4 align-top text-xs">
                    <p className="text-ngpa-white/85 font-bold text-sm">
                      {r.parentName || "—"}
                    </p>
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="block text-ngpa-teal hover:underline truncate max-w-[14rem] mt-0.5"
                      >
                        {r.email}
                      </a>
                    )}
                    {r.phone && (
                      <a
                        href={`sms:${r.phone.replace(/\D/g, "")}`}
                        className="block text-ngpa-white/70 hover:text-ngpa-teal mt-0.5"
                      >
                        {r.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 sm:px-5 py-4 align-top">
                    <span
                      className={
                        r.vote === "Yes"
                          ? "px-2 py-0.5 rounded-full bg-ngpa-teal/15 text-ngpa-teal text-xs font-bold"
                          : r.vote === "Maybe"
                            ? "px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold"
                            : "px-2 py-0.5 rounded-full bg-ngpa-slate/30 text-ngpa-white/55 text-xs font-bold"
                      }
                    >
                      {r.vote || "—"}
                    </span>
                  </td>
                  <td className="px-4 sm:px-5 py-4 align-top text-xs text-ngpa-white/70 hidden sm:table-cell max-w-md">
                    {r.note || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmCrewForm pollSlug={poll.slug} yesResponses={yes} />
    </>
  );
}
