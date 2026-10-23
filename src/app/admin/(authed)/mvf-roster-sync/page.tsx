import { requireAdmin } from "@/lib/require-admin";
import ResendForm from "./ResendForm";

export const dynamic = "force-dynamic";
export default async function MvfRosterSyncPage() {
  await requireAdmin();
  return <section className="max-w-xl space-y-5">
    <h1 className="font-heading text-2xl font-black">MVF tournament sync</h1>
    <p className="text-base text-ngpa-white/75">
      Enter the existing invoice ID from the tournament registration. Preview checks
      the verified NGA payment before syncing it to the protected Link &amp; Dink entry.
      This keeps payment with NGA and sends no invoice or email. To recover a missing
      player, choose roster recovery instead. Review the division before syncing.
    </p>
    <ResendForm />
  </section>;
}
