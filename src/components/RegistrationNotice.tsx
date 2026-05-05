import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-xl p-5 mb-8">
      <h3 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
        How to Register
      </h3>
      <p className="text-sm text-ngpa-muted leading-relaxed">
        Sessions run weekly at $35/session, billed monthly via subscription.
        Mid-month signups are prorated. Email us at{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ngpa-cyan hover:underline"
        >
          {site.email}
        </a>{" "}
        or text Sam at{" "}
        <a
          href={`tel:${site.phone.replace(/\D/g, "")}`}
          className="text-ngpa-cyan hover:underline"
        >
          {site.phone}
        </a>{" "}
        for the current schedule and to reserve a spot. We&rsquo;ll confirm location and time within 24 hours.
      </p>
    </div>
  );
}
