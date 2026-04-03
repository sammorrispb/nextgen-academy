import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-xl p-5 mb-8">
      <h3 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
        How to Register
      </h3>
      <p className="text-sm text-ngpa-muted leading-relaxed">
        Tap <strong className="text-ngpa-white">Register</strong> to sign up on
        CourtReserve. If registration is closed or you need help, email us at{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ngpa-cyan hover:underline"
        >
          {site.email}
        </a>{" "}
        or call{" "}
        <a
          href={`tel:${site.phone.replace(/\D/g, "")}`}
          className="text-ngpa-cyan hover:underline"
        >
          {site.phone}
        </a>
        . Times may vary — check your CourtReserve confirmation for exact start times.
      </p>
    </div>
  );
}
