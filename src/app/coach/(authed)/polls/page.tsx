import Link from "next/link";
import { fetchOpenPolls, fetchPollResponses } from "@/lib/notion-crew-polls";

export const dynamic = "force-dynamic";

export default async function CoachPollsPage() {
  const polls = await fetchOpenPolls();
  const counts = await Promise.all(
    polls.map((p) =>
      fetchPollResponses(p.id).then((rs) => ({
        yes: rs.filter((r) => r.vote === "Yes").length,
        maybe: rs.filter((r) => r.vote === "Maybe").length,
        no: rs.filter((r) => r.vote === "No").length,
      })),
    ),
  );

  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Dashboard
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Crew polls
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        Candidate slots you&rsquo;ve dropped to WhatsApp. Open polls only &mdash;
        flip a poll&rsquo;s Status in Notion to manage history.
      </p>

      {polls.length === 0 ? (
        <div className="px-5 py-6 rounded-2xl border border-ngpa-slate/60 bg-ngpa-panel/60 text-ngpa-white/70">
          No open polls. Add a row to the NGA Crew Polls Notion DB and set
          Status = Open.
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map((p, i) => {
            const c = counts[i];
            return (
              <Link
                key={p.id}
                href={`/coach/polls/${p.slug}`}
                className="block bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6 hover:border-ngpa-teal/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-ngpa-teal mb-1">
                      {p.day} · {p.startTime}
                      {p.endTime ? `–${p.endTime}` : ""}
                    </p>
                    <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
                      {p.title}
                    </p>
                    <p className="text-sm text-ngpa-white/65 mt-0.5">
                      {p.location} {p.level ? `· ${p.level}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-2xl text-ngpa-teal leading-none">
                      {c.yes}
                      <span className="text-sm text-ngpa-white/60">
                        {" "}
                        / {p.minPartySize}
                      </span>
                    </p>
                    <p className="text-xs text-ngpa-white/60 mt-1">
                      yes · {c.maybe} maybe · {c.no} no
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
