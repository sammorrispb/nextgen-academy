import { listUpcomingSessions } from "@/lib/notion-sessions-admin";
import SessionsEditor from "./SessionsEditor";

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
    </div>
  );
}
