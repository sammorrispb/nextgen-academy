import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function requireAdmin(): Promise<void> {
  const c = await cookies();
  if (!verifyAdminSessionValue(c.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect("/admin/login");
  }
}

export default async function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-ngpa-deep text-ngpa-white">
      <header className="border-b border-ngpa-slate/40 bg-ngpa-panel/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <span className="font-heading text-lg sm:text-xl font-black tracking-tight">
            NGA Admin
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
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">{children}</main>
    </div>
  );
}
