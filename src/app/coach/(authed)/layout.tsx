import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COACH_SESSION_COOKIE,
  verifySessionCookieValue,
} from "@/lib/coach-auth";
import { isAllowedCoachEmail } from "@/lib/coach-allowlist";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function requireCoach(): Promise<string> {
  const c = await cookies();
  const value = c.get(COACH_SESSION_COOKIE)?.value;
  const email = value ? verifySessionCookieValue(value) : null;
  if (!email || !isAllowedCoachEmail(email)) {
    redirect("/coach/login");
  }
  return email;
}

export default async function CoachAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await requireCoach();

  return (
    <div className="min-h-screen bg-ngpa-deep text-ngpa-white">
      <header className="border-b border-ngpa-slate/40 bg-ngpa-panel/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <Link
            href="/coach"
            className="font-heading text-lg sm:text-xl font-black tracking-tight hover:text-ngpa-teal transition-colors"
          >
            NGA Coach
          </Link>
          <div className="flex items-center gap-3 text-xs text-ngpa-white/65">
            <span className="hidden sm:inline truncate max-w-[16rem]">
              {email}
            </span>
            <form action="/coach/logout" method="post">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[32px] font-bold text-xs"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}
