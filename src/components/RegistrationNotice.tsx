import { site } from "@/data/site";

export default function RegistrationNotice() {
  return (
    <div className="bg-ngpa-panel border border-ngpa-slate rounded-2xl p-6 sm:p-8 border-l-4 border-l-ngpa-cyan mb-10">
      <div className="flex items-start gap-3 mb-4">
        <svg
          className="w-6 h-6 text-ngpa-cyan shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <h3 className="font-heading text-lg font-bold text-ngpa-white">
          How to Register
        </h3>
      </div>

      <ol className="space-y-3 text-sm leading-relaxed text-ngpa-muted list-decimal list-inside">
        <li>
          <strong className="text-ngpa-white">More than 24 hours out?</strong>{" "}
          Register online via CourtReserve using the buttons below.
        </li>
        <li>
          <strong className="text-ngpa-white">Within 24 hours?</strong>{" "}
          Online registration closes 24 hours before each session. Email us
          directly at{" "}
          <a
            href={`mailto:${site.email}?subject=${encodeURIComponent("Registration Request")}`}
            className="text-ngpa-cyan hover:underline"
          >
            {site.email}
          </a>
          .
        </li>
        <li>
          <strong className="text-ngpa-white">Not on CourtReserve yet?</strong>{" "}
          It&apos;s our official registration platform — sign up there or{" "}
          <a
            href={`mailto:${site.email}?subject=${encodeURIComponent("Registration Request")}`}
            className="text-ngpa-cyan hover:underline"
          >
            email us
          </a>{" "}
          and we&apos;ll handle it for you.
        </li>
      </ol>

      <div className="mt-6 bg-ngpa-orange/10 border-l-4 border-l-ngpa-orange rounded-r-lg p-4 flex items-start gap-3">
        <svg
          className="w-5 h-5 text-ngpa-orange shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <div>
          <p className="text-sm font-bold text-ngpa-white">Times May Vary</p>
          <p className="text-sm text-ngpa-muted mt-1 leading-relaxed">
            Times listed are approximate and may shift due to other Dill Dinkers
            events on certain dates. Check your{" "}
            <strong className="text-ngpa-white">CourtReserve confirmation email</strong>{" "}
            and{" "}
            <strong className="text-ngpa-white">&ldquo;My Events&rdquo;</strong>{" "}
            on CourtReserve for official start times.
          </p>
        </div>
      </div>
    </div>
  );
}
