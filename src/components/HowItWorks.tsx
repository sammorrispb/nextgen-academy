import TrackedCTA from "@/components/TrackedCTA";

interface Step {
  number: string;
  title: string;
  body: React.ReactNode;
}

const steps: Step[] = [
  {
    number: "1",
    title: "Free evaluation",
    body: (
      <>
        30 minutes on court. Your coach watches your child play, then recommends
        the right next step &mdash; private lessons (Red or Orange Ball) or a
        group session (Green or Yellow Ball).
      </>
    ),
  },
  {
    number: "2",
    title: "Drop in to sessions",
    body: (
      <>
        <span className="font-bold text-ngpa-white">$40 per 1-hour session</span>{" "}
        ($80 for both slots). Drop in anytime &mdash; no contracts, no monthly
        fees.
      </>
    ),
  },
  {
    number: "3",
    title: "Move up the pathway",
    body: (
      <>
        Earn your way from Red to Yellow at your own pace. Tournament-ready kids
        get an invite to the Yellow Ball track.
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative bg-ngpa-deep py-16 sm:py-20 px-4 sm:px-6 lg:px-10 border-t border-ngpa-slate/40"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <p className="font-heading text-xs font-bold text-ngpa-teal uppercase tracking-[0.2em] mb-3">
            How it works
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
            Three steps onto the pathway.
          </h2>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {steps.map((step) => (
            <li
              key={step.number}
              className="relative rounded-2xl bg-ngpa-panel/80 backdrop-blur-sm border border-ngpa-slate/60 p-6 sm:p-7"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-ngpa-teal text-ngpa-deep font-heading font-black text-base"
                >
                  {step.number}
                </span>
                <h3 className="font-heading text-lg sm:text-xl font-bold text-ngpa-white">
                  {step.title}
                </h3>
              </div>
              <p className="text-base text-ngpa-white/80 leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <TrackedCTA
            href="#contact-form"
            label="how_it_works_book_eval"
            section="how_it_works"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-lg shadow-ngpa-teal/20 min-h-[48px]"
          >
            Start with a free evaluation
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </TrackedCTA>
        </div>
      </div>
    </section>
  );
}
