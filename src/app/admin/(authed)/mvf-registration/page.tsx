import type { Metadata } from "next";
import { requireAdmin } from "@/lib/require-admin";
import {
  MVF_JUNIOR_TOURNAMENT_DATE_ISO,
  MVF_JUNIOR_TOURNAMENT_DATE_LABEL,
} from "@/data/mvf-junior-tournament-2026";
import MvfRegistrationForm from "./MvfRegistrationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "MVF tournament registration | NGA Admin",
  robots: { index: false, follow: false },
};

export default async function MvfRegistrationPage() {
  await requireAdmin();

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-teal-bright">
          MVF Junior Tournament
        </p>
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
          Register a player
        </h1>
        <p className="text-base leading-relaxed text-ngpa-white/75">
          <time dateTime={MVF_JUNIOR_TOURNAMENT_DATE_ISO}>
            {MVF_JUNIOR_TOURNAMENT_DATE_LABEL}
          </time>
          {" · 14U event"}
        </p>
        <p className="max-w-2xl text-base leading-relaxed text-ngpa-white/75">
          Check the family&rsquo;s signed waiver, review the player and fee, then
          register with NGA, email the parent&rsquo;s invoice and add the protected
          junior entry to Link &amp; Dink.
        </p>
      </header>
      <MvfRegistrationForm />
    </section>
  );
}
