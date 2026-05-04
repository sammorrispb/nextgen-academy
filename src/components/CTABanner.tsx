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
  variant = "red",
  trackingLabel,
  trackingSection = "cta_banner",
}: CTABannerProps) {
  const bg = variant === "dark" ? "bg-ngpa-panel" : "bg-ngpa-slate";
  const label = trackingLabel ?? `${trackingSection}_${slugify(buttonText)}`;
  return (
    <section className={`${bg} py-16 px-4`}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-4">
          {heading}
        </h2>
        <p className="text-ngpa-muted text-lg mb-8 leading-relaxed">{description}</p>
        <TrackedCTA
          href={buttonHref}
          label={label}
          section={trackingSection}
          asNextLink
          className="inline-block px-8 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
        >
          {buttonText}
        </TrackedCTA>
      </div>
    </section>
  );
}
