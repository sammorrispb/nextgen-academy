import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-xl p-5 mb-8">
      <h3 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
        How to Register
      </h3>
      <p className="text-sm text-ngpa-muted leading-relaxed">
        <strong className="text-ngpa-white">$35 per session.</strong> Drop-in
        only — no subscription, no commitment. Pick the dates that work for
        you below. Sessions open for registration 7 days ahead. Spots are
        capped at 4 players per court, so reserve early. Payments are
        non-refundable. Questions? Email{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ngpa-cyan hover:underline"
        >
          {site.email}
        </a>{" "}
        or text{" "}
        <a
          href={`tel:${site.phone.replace(/\D/g, "")}`}
          className="text-ngpa-cyan hover:underline"
        >
          {site.phone}
        </a>
        .
      </p>
    </div>
  );
}
