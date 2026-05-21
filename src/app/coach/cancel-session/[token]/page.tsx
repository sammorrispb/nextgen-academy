import type { Metadata } from "next";
import { fetchSessionById } from "@/lib/notion-sessions";
import { verifySessionCancelToken } from "@/lib/session-cancel-token";
import ConfirmCancelClient from "./ConfirmCancelClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

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

interface PageProps {
  params: Promise<{ token: string }>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ngpa-deep text-ngpa-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

export default async function CancelSessionPage({ params }: PageProps) {
  const { token } = await params;
  const sessionId = verifySessionCancelToken(decodeURIComponent(token));

  if (!sessionId) {
    return (
      <Shell>
        <h1 className="font-heading text-2xl font-black mb-2">Link not valid</h1>
        <p className="text-ngpa-white/70 text-sm">
          This cancel link is invalid or has expired. Open the coach dashboard and cancel from the
          session page instead.
        </p>
      </Shell>
    );
  }

  const session = await fetchSessionById(sessionId);
  if (!session) {
    return (
      <Shell>
        <h1 className="font-heading text-2xl font-black mb-2">Session not found</h1>
        <p className="text-ngpa-white/70 text-sm">
          We couldn’t find that session — it may have been removed.
        </p>
      </Shell>
    );
  }

  if (session.status === "Cancelled") {
    return (
      <Shell>
        <h1 className="font-heading text-2xl font-black mb-2">Already cancelled</h1>
        <p className="text-ngpa-white/70 text-sm">
          {session.title} on {formatLongDate(session.date)} is already cancelled. Nothing else to do.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Cancel session
      </p>
      <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight mb-1">
        {session.title}
      </h1>
      <p className="text-sm text-ngpa-white/70 mb-1">
        {formatLongDate(session.date)} · {session.startTime}
      </p>
      <p className="text-sm text-ngpa-white/70 mb-6">
        {session.location} · {session.registeredCount} registered
      </p>

      <ConfirmCancelClient
        token={token}
        sessionTitle={session.title}
        rosterSize={session.registeredCount}
      />
    </Shell>
  );
}
