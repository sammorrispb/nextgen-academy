import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await requireAdmin();

  return (
    <div className="min-h-screen bg-ngpa-deep text-ngpa-white">
      <header className="border-b border-ngpa-slate/40 bg-ngpa-panel/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <span className="font-heading text-lg sm:text-xl font-black tracking-tight">
            NGA Admin
          </span>
          <div className="flex items-center gap-3 text-xs text-ngpa-white/65">
            <span className="hidden sm:inline truncate max-w-[16rem]">
              {email}
            </span>
            <form action="/admin/logout" method="post">
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
      <nav className="border-b border-ngpa-slate/30 bg-ngpa-panel/25">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 flex gap-1 overflow-x-auto">
          {[
            { href: "/admin/sessions", label: "Sessions & camps" },
            { href: "/admin/monday-girls", label: "Monday Girls" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-3 font-heading text-xs font-bold text-ngpa-white/70 hover:text-ngpa-teal whitespace-nowrap min-h-[44px] flex items-center"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">{children}</main>
    </div>
  );
}
