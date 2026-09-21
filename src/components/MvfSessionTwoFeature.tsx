"use client";

import TrackedCTA from "@/components/TrackedCTA";

// Session II as a product: Oct 15 – Nov 19, 2026, six Thursdays, two classes
// back to back, $90 resident / $100 non-resident. Registration runs through
// MVF's ActiveCommunities — this card is the storefront, MVF is the register.

const SESSION_2 = {
  dates: "Oct 15 – Nov 19, 2026",
  classes: [
    {
      label: "Red / Orange",
      time: "5:30–6:30 PM",
      blurb: "Still learning to rally and get into games.",
      registerUrl:
        "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-fall-ii-beginner-ages-8-to-16/9361",
      ctaLabel: "session2_register_beginner",
    },
    {
      label: "Green / Yellow",
      time: "6:30–7:30 PM",
      blurb: "Playing games already — working on strategy.",
      registerUrl:
        "https://apm.activecommunities.com/montgomeryvillage/Activity_Search/youth-pickleball-fall-ii-advanced-ages-8-to-16/9362",
      ctaLabel: "session2_register_advanced",
    },
  ],
};

export default function MvfSessionTwoFeature({
  section = "mvf_session_2_feature",
  heading = "Enrolling now: Fall Session II",
}: {
  section?: string;
  heading?: string;
}) {
  return (
    <div
      className="rounded-3xl bg-gradient-to-br from-ngpa-teal/15 via-ngpa-panel to-ngpa-panel border border-ngpa-teal/40 p-6 sm:p-10 shadow-2xl shadow-ngpa-teal/10"
      data-testid="mvf-session-2-feature"
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="inline-flex items-center gap-2 rounded-full bg-ngpa-teal px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-ngpa-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-ngpa-deep animate-pulse" aria-hidden="true" />
          Enrolling now
        </p>
        <p className="text-sm font-bold text-ngpa-white/70">
          Montgomery Village Foundation · North Creek courts
        </p>
      </div>

      <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight">
        {heading}
      </h2>
      <p className="mt-3 text-lg text-ngpa-white/80 leading-relaxed max-w-2xl">
        Six Thursday evenings, {SESSION_2.dates}. Two classes back to back so
        your kid gets real reps with like-skilled players — same coaches, same
        courts, same format families loved in Session I.{" "}
        <strong className="text-ngpa-white">
          $90 resident / $100 non-resident
        </strong>{" "}
        for all six weeks.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SESSION_2.classes.map((cls) => (
          <div
            key={cls.label}
            className="rounded-2xl bg-ngpa-deep/60 border border-ngpa-slate/60 p-5 sm:p-6 flex flex-col"
          >
            <p className="font-heading text-lg font-black text-ngpa-white">
              {cls.label}
            </p>
            <p className="text-sm font-bold text-ngpa-teal-bright mt-1">
              Thursdays · {cls.time}
            </p>
            <p className="text-sm text-ngpa-white/70 mt-2 flex-1">{cls.blurb}</p>
            <TrackedCTA
              href={cls.registerUrl}
              label={cls.ctaLabel}
              section={section}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center px-6 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
            >
              Register on MVF &rarr;
            </TrackedCTA>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-ngpa-white/55 leading-relaxed">
        Registration runs through the Montgomery Village Foundation&rsquo;s
        ActiveCommunities portal. Not sure which class fits?{" "}
        <a
          href="/free-evaluation/book"
          className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
        >
          Book a free evaluation
        </a>{" "}
        and we&rsquo;ll place your player.
      </p>
    </div>
  );
}
