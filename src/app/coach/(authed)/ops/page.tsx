import Link from "next/link";
import { requireCoach } from "@/lib/coach-auth-server";
import { isOpsLiveSendAdmin } from "@/lib/ops-authz";
import OpsConsole from "./OpsConsole";

export const dynamic = "force-dynamic";

export default async function CoachOpsPage() {
  // The layout already redirects unauthenticated visitors; this read only
  // decides the admin affordances (live send button, ambiguous toggle). The
  // REAL gate is server-side in actions.ts either way.
  const email = await requireCoach();
  const isAdmin = email ? isOpsLiveSendAdmin(email) : false;

  return (
    <>
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
        Ops console
      </p>
      <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
        Outreach ops
      </h1>
      <p className="text-base text-ngpa-white/70 leading-relaxed mb-8 max-w-2xl">
        The three terminal-only ops, without the terminal. Every action runs a
        dry-run preview first — recipient counts and the exact list — and
        &ldquo;Send live&rdquo; only unlocks after a preview of the same
        settings. Previews are open to every coach; live sends are admin-only.
        DD-derived and opted-out contacts are excluded automatically on every
        path.
      </p>

      <OpsConsole isAdmin={isAdmin} />

      <p className="mt-8 text-sm text-ngpa-white/55">
        <Link href="/coach" className="hover:text-ngpa-teal transition-colors">
          ← Back to dashboard
        </Link>
      </p>
    </>
  );
}
