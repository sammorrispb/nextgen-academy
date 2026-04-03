import { levels } from "@/data/levels";

export default function BallPathway() {
  return (
    <div className="mb-10">
      {/* Desktop: horizontal pathway */}
      <div className="hidden sm:flex items-center justify-center gap-0">
        {levels.map((level, i) => (
          <div key={level.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-lg"
                style={{
                  backgroundColor: `${level.color}20`,
                  borderColor: level.color,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: level.color }}
                />
              </div>
              <span
                className="font-heading text-sm font-bold mt-2"
                style={{ color: level.color }}
              >
                {level.label}
              </span>
              <span className="text-ngpa-muted text-xs">Ages {level.ages}</span>
            </div>
            {/* Arrow connector */}
            {i < levels.length - 1 && (
              <div className="flex items-center mx-4 -mt-6">
                <div className="w-12 h-0.5 bg-ngpa-slate" />
                <svg
                  className="w-3 h-3 text-ngpa-slate -ml-0.5"
                  fill="currentColor"
                  viewBox="0 0 12 12"
                >
                  <path d="M4 1l5 5-5 5V1z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical pathway */}
      <div className="flex sm:hidden flex-col items-center gap-0">
        {levels.map((level, i) => (
          <div key={level.key} className="flex flex-col items-center">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center border-2 shrink-0"
                style={{
                  backgroundColor: `${level.color}20`,
                  borderColor: level.color,
                }}
              >
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: level.color }}
                />
              </div>
              <div>
                <span
                  className="font-heading text-sm font-bold"
                  style={{ color: level.color }}
                >
                  {level.label}
                </span>
                <span className="text-ngpa-muted text-xs ml-2">
                  Ages {level.ages}
                </span>
              </div>
            </div>
            {/* Down arrow */}
            {i < levels.length - 1 && (
              <div className="flex flex-col items-center my-1">
                <div className="w-0.5 h-4 bg-ngpa-slate" />
                <svg
                  className="w-3 h-3 text-ngpa-slate -mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 12 12"
                >
                  <path d="M1 4l5 5 5-5H1z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help text */}
      <p className="text-center text-ngpa-muted text-sm mt-6">
        Not sure where your child fits?{" "}
        <a
          href="#contact-form"
          className="text-ngpa-lime font-semibold hover:text-ngpa-cyan transition-colors"
        >
          We&rsquo;ll help you find the right level &darr;
        </a>
      </p>
    </div>
  );
}
