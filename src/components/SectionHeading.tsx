interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  centered?: boolean;
  as?: "h1" | "h2" | "h3";
}

export default function SectionHeading({
  title,
  subtitle,
  eyebrow,
  centered = false,
  as: Tag = "h2",
}: SectionHeadingProps) {
  return (
    <div className={`mb-10 sm:mb-12 ${centered ? "text-center" : ""}`}>
      {eyebrow && (
        <p
          className={`text-xs sm:text-sm font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3 ${
            centered ? "" : ""
          }`}
        >
          {eyebrow}
        </p>
      )}
      <Tag className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black text-ngpa-white leading-[1.05] tracking-tight">
        {title}
      </Tag>
      {subtitle && (
        <p
          className={`mt-4 text-base sm:text-lg text-ngpa-white/70 leading-relaxed max-w-2xl ${
            centered ? "mx-auto" : ""
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
