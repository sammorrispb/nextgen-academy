import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function requireAdmin(): Promise<string> {
  const c = await cookies();
  const email = verifyAdminSessionEmail(c.get(ADMIN_SESSION_COOKIE)?.value);
  if (!email || !isAllowedAdminEmail(email)) {
    redirect("/admin/login");
  }
  return email;
}

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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">{children}</main>
    </div>
  );
}
