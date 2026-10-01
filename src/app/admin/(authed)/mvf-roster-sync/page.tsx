import { requireAdmin } from "@/lib/require-admin";
import ResendForm from "./ResendForm";

export const dynamic = "force-dynamic";
export default async function MvfRosterSyncPage() {
  await requireAdmin();
  return <section className="max-w-xl space-y-5">
    <h1 className="font-heading text-2xl font-black">MVF tournament roster sync</h1>
    <p className="text-base text-ngpa-white/75">
      Enter the existing invoice ID from the tournament registration. Preview checks
      whether that registration can join its Link &amp; Dink roster. Review the division
      before syncing. The invoice and payment status stay unchanged.
    </p>
    <ResendForm />
  </section>;
}
