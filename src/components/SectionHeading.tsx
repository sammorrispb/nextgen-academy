interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  as?: "h1" | "h2" | "h3";
}

export default function SectionHeading({ title, subtitle, centered = false, as: Tag = "h2" }: SectionHeadingProps) {
  return (
    <div className={`mb-8 ${centered ? "text-center" : ""}`}>
      <Tag className="font-heading text-3xl sm:text-4xl font-bold text-ngpa-white">
        {title}
      </Tag>
      {subtitle && (
        <p className="mt-3 text-lg text-ngpa-muted max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
