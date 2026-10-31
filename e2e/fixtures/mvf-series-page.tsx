import MvfSeriesRegistrationForm from "@/components/MvfSeriesRegistrationForm";
import type { SeriesRelease } from "@/data/mvf-series-registration";
import { findMvfJuniorSeriesEvent } from "@/data/mvf-junior-series";
// This route is copied only into the browser runner's private workspace.
const release: SeriesRelease = { event: "november-2026", revision: "synthetic-v1", date: "2027-02-20", startTime: "10:00 AM", endTime: "1:00 PM", registrationClosesAt: "2027-02-10T15:00:00Z", eligibility: { "12u": { minAge: 6, maxAge: 12 }, "16u": { minAge: 13, maxAge: 16 } }, multipleBrackets: false, eligibilityText: "Synthetic eligibility for offline tests only.", minimumEnrollmentPolicy: "Synthetic operator review.", cancellationPolicy: "Synthetic cancellation policy.", rainPolicy: "Synthetic indoor plan.", invoiceDueDays: 7, ngaRevenueShare: 0.8 };
export default function Page() { return <article className="max-w-2xl mx-auto p-5"><h1>Synthetic registration fixture — not published</h1><MvfSeriesRegistrationForm release={release} event={findMvfJuniorSeriesEvent("november-2026")!} /></article>; }
