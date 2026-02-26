import Link from "next/link";

interface CTABannerProps {
  heading: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  variant?: "red" | "dark";
}

export default function CTABanner({
  heading,
  description,
  buttonText,
  buttonHref,
  variant = "red",
}: CTABannerProps) {
  const bg = variant === "dark" ? "bg-ngpa-panel" : "bg-ngpa-slate";
  return (
    <section className={`${bg} py-16 px-4`}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ngpa-white mb-4">
          {heading}
        </h2>
        <p className="text-ngpa-muted text-lg mb-8 leading-relaxed">{description}</p>
        <Link
          href={buttonHref}
          className="inline-block px-8 py-3 bg-ngpa-lime text-ngpa-black font-bold rounded-full hover:bg-ngpa-cyan transition-colors"
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
