import Image from "next/image";
import TrackedCTA from "@/components/TrackedCTA";

interface CTABannerProps {
  heading: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  variant?: "red" | "dark";
  /** Override the analytics label (defaults to a slug derived from heading). */
  trackingLabel?: string;
  /** Section name for analytics — e.g. "schedule_cta_banner". */
  trackingSection?: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function CTABanner({
  heading,
  description,
  buttonText,
  buttonHref,
  trackingLabel,
  trackingSection = "cta_banner",
}: CTABannerProps) {
  const label = trackingLabel ?? `${trackingSection}_${slugify(buttonText)}`;
  return (
    <section className="relative isolate overflow-hidden bg-ngpa-deep py-16 sm:py-20 px-4">
      {/* Photo backdrop — courts in motion */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src="/images/multi-court-outdoor.jpeg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-ngpa-deep/85 via-ngpa-deep/75 to-ngpa-deep/90" />
      </div>

      {/* Teal glow accent */}
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-ngpa-teal/15 blur-3xl"
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white mb-5 tracking-tight">
          {heading}
        </h2>
        <p className="text-ngpa-white/75 text-lg mb-9 leading-relaxed">
          {description}
        </p>
        <TrackedCTA
          href={buttonHref}
          label={label}
          section={trackingSection}
          asNextLink
          className="inline-flex items-center gap-2 px-8 py-4 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors shadow-xl shadow-ngpa-teal/20 min-h-[48px]"
        >
          {buttonText}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </TrackedCTA>
      </div>
    </section>
  );
}
