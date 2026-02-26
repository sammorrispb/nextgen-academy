interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
}

export default function SectionHeading({ title, subtitle, centered = false }: SectionHeadingProps) {
  return (
    <div className={`mb-8 ${centered ? "text-center" : ""}`}>
      <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-lg text-gray-600 max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
