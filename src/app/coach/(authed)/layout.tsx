import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/coach-auth-server";
import CoachFamilySearch from "./CoachFamilySearch";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CoachAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await requireCoach();
  if (!email) {
    redirect("/coach/login");
  }

  return (
    <div className="min-h-screen bg-ngpa-deep text-ngpa-white">
      <header className="border-b border-ngpa-slate/40 bg-ngpa-panel/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <Link
            href="/coach"
            className="font-heading text-lg sm:text-xl font-black tracking-tight hover:text-ngpa-teal transition-colors shrink-0"
          >
            NGA Coach
          </Link>
          <CoachFamilySearch />
          <div className="flex items-center gap-3 text-xs text-ngpa-white/65 shrink-0">
            <span className="hidden lg:inline truncate max-w-[12rem]">
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
