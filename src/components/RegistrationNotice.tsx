import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 rounded-2xl p-6 mb-8">
      <h3 className="font-heading text-sm font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
        How to Register
      </h3>
      <p className="text-base text-ngpa-white/80 leading-relaxed">
        <strong className="text-ngpa-white">$35 per session.</strong> Drop-in
        only — no subscription, no commitment. Pick the dates that work for
        you below. Sessions open for registration 7 days ahead. Spots are
        capped at 4 players per court, so reserve early. Payments are
        non-refundable. Questions? Email{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ngpa-teal hover:text-ngpa-teal-bright transition-colors font-semibold underline-offset-4 hover:underline"
        >
          {site.email}
        </a>{" "}
        or text{" "}
        <a
          href={`tel:${site.phone.replace(/\D/g, "")}`}
          className="text-ngpa-teal hover:text-ngpa-teal-bright transition-colors font-semibold underline-offset-4 hover:underline"
        >
          {site.phone}
        </a>
        .
      </p>
    </div>
  );
}
