import type { Metadata } from "next";
import { requireAdmin } from "@/lib/require-admin";
import MvfCapacityExportForm from "./MvfCapacityExportForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Capacity reconciliation | NGA Admin",
  robots: { index: false, follow: false },
};

export default async function MvfCapacityExportPage() {
  await requireAdmin();

  return <section className="space-y-8">
    <header className="space-y-3">
      <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-teal-bright">
        MVF Junior Tournament
      </p>
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Capacity reconciliation
      </h1>
      <p className="max-w-2xl text-base leading-relaxed text-ngpa-white/75">
        Enter the reviewed invoice IDs and their original divisions to prepare
        private reconciliation keys. Review each invoice&rsquo;s current provider
        status and original details before the separate capacity release.
      </p>
    </header>
    <MvfCapacityExportForm />
  </section>;
}
