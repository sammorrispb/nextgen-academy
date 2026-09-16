import { listUpcomingSessions } from "@/lib/notion-sessions-admin";
import { CAMPS } from "@/data/camps";
import { partitionCamps } from "@/lib/admin-sessions-view";
import SessionsEditor from "./SessionsEditor";
import CampsPanel from "./CampsPanel";

export const dynamic = "force-dynamic";

const todayIsoET = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  let sessions = [] as Awaited<ReturnType<typeof listUpcomingSessions>>;
  let error: string | null = null;
  try {
    sessions = await listUpcomingSessions();
  } catch (e) {
    error = String((e as Error).message || e);
  }

  const { current, past } = partitionCamps(CAMPS, todayIsoET());
  const toSummary = (c: (typeof CAMPS)[number]) => ({
    slug: c.slug,
    title: c.title,
    weekLabel: c.weekLabel,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-black">Sessions</h1>
        <p className="text-ngpa-white/65 text-sm mt-1">
          Upcoming NGA sessions (next ~4 months). Edit and save — changes write straight to the
          schedule. Registered counts are set by checkout and shown read-only.
        </p>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 p-4 text-sm">
          Couldn’t load sessions: {error}
        </div>
      ) : (
        <SessionsEditor initial={sessions} focusId={focus ?? null} />
      )}

      <div className="mb-4 mt-10">
        <h2 className="font-heading text-xl sm:text-2xl font-black">Camps</h2>
        <p className="text-ngpa-white/65 text-sm mt-1">
          Camp rosters, read live from Stripe. Expand a week to see who’s registered or to cancel +
          refund a camper.
        </p>
      </div>
      {current.length > 0 ? (
        <CampsPanel camps={current.map(toSummary)} />
      ) : (
        <p className="rounded-xl border border-ngpa-slate/60 bg-ngpa-panel/40 p-4 text-sm text-ngpa-white/70">
          No camps on the calendar right now.
        </p>
      )}
      {past.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer min-h-12 flex items-center text-sm font-bold text-ngpa-white/60 hover:text-ngpa-white">
            Past camps ({past.length})
          </summary>
          <div className="mt-2">
            <CampsPanel camps={past.map(toSummary)} />
          </div>
        </details>
      )}
    </div>
  );
}
