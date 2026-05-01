import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-xl p-5 mb-8">
      <h3 className="font-heading text-sm font-bold text-ngpa-white uppercase tracking-wider mb-3">
        How to Register
      </h3>
      <p className="text-sm text-ngpa-muted leading-relaxed">
        Registration is by email. The schedule below is a live reference of
        what&rsquo;s running &mdash; to enroll your child in a weekly slot,
        email{" "}
        <a
          href={`mailto:${site.email}?subject=Enrollment%20Inquiry`}
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
        . Once placed, you&rsquo;re billed at the start of each month for that
        month&rsquo;s sessions.
      </p>
    </div>
  );
}
