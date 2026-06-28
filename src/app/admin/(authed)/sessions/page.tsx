import { listUpcomingSessions } from "@/lib/notion-sessions-admin";
import { CAMPS } from "@/data/camps";
import SessionsEditor from "./SessionsEditor";
import CampsPanel from "./CampsPanel";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-heading text-xl sm:text-2xl font-black">Camps</h2>
        <p className="text-ngpa-white/65 text-sm mt-1">
          Summer camp rosters, read live from Stripe. Expand a week to see who’s registered or to
          cancel + refund a camper.
        </p>
      </div>
      <CampsPanel
        camps={CAMPS.map((c) => ({ slug: c.slug, title: c.title, weekLabel: c.weekLabel }))}
      />

      <div className="mb-6 mt-10">
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
    </div>
  );
}
