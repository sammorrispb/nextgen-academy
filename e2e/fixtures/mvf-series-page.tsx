import TournamentBanner from "@/components/TournamentBanner";
import MvfSeriesRegistrationForm from "@/components/MvfSeriesRegistrationForm";
import type { SeriesRelease } from "@/data/mvf-series-registration";
import { findMvfJuniorSeriesEvent } from "@/data/mvf-junior-series";
// This route is copied only into the browser runner's private workspace.
const release: SeriesRelease = { event: "november-2026", revision: "synthetic-v1", date: "2027-02-20", startTime: "10:00 AM", endTime: "1:00 PM", registrationClosesAt: "2027-02-10T15:00:00Z", eligibility: { "12u": { minAge: 6, maxAge: 12 }, "16u": { minAge: 13, maxAge: 16 } }, multipleBrackets: false, eligibilityText: "Synthetic eligibility for offline tests only.", minimumEnrollmentPolicy: "Synthetic operator review.", cancellationPolicy: "Synthetic cancellation policy.", rainPolicy: "Synthetic indoor plan.", invoiceDueDays: 7, ngaRevenueShare: 0.8 };
export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams ?? {};
  if (query.banner === "1") {
    const sample = { href: "/mvf-junior-tournament/november-2026", eventIso: "2026-11-14", dateLabel: "Sat, Nov 14", divisionsLabel: "12U & 16U", registrationOpen: query.open !== "0", registrationClosesAt: query.closes ?? "2026-11-13T17:00:00Z" };
    return <section aria-label="Synthetic tournament banner"><h1>Synthetic banner fixture — not published</h1><TournamentBanner {...sample} /></section>;
  }
  return <article className="max-w-2xl mx-auto p-5"><h1>Synthetic registration fixture — not published</h1><MvfSeriesRegistrationForm release={release} event={findMvfJuniorSeriesEvent("november-2026")!} /></article>; }
