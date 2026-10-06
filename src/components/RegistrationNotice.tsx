import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 rounded-2xl p-6 mb-8">
      <h3 className="font-heading text-sm font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
        How to Register
      </h3>
      <p className="text-base text-ngpa-white/80 leading-relaxed">
        <strong className="text-ngpa-white">
          Check the specific program before registering.
        </strong>{" "}
        Program pages list the dates, venue, age and level fit, format, and
        registration route. For a drop-in listed below, check that session&rsquo;s
        details. Follow the program&rsquo;s payment and confirmation steps;
        refund and weather rules differ by program. Questions? Email{" "}
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
