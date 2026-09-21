"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/funnelClient";

// The three doors Sam named: new to pickleball → evaluation or lessons;
// looking to play → leagues or MVF; looking to improve → lessons. Sits right
// under the hero so nobody has to decode twelve nav items to find their next
// step.

const INTENTS = [
  {
    id: "new-to-pickleball",
    eyebrow: "New to pickleball",
    title: "Start with a free evaluation",
    body: "Never played or just getting going? We'll place your player at the right level in 30 minutes — free, no commitment.",
    primary: { href: "/free-evaluation/book", label: "Book a free evaluation" },
    secondary: { href: "/lessons", label: "Or see lessons →" },
  },
  {
    id: "looking-to-play",
    eyebrow: "Looking to play",
    title: "Join a league or a class",
    body: "Ready for regular games. Weekly leagues at Walter Johnson or Session 2 classes with Montgomery Village Foundation.",
    primary: { href: "/league", label: "See leagues" },
    secondary: {
      href: "/montgomery-village-youth-pickleball",
      label: "MVF Session 2 →",
    },
  },
  {
    id: "looking-to-improve",
    eyebrow: "Looking to improve",
    title: "Train with a coach",
    body: "Already playing and want to level up? One hour private or group — $60, scheduled around your family.",
    primary: { href: "/lessons", label: "Book a lesson" },
    secondary: { href: "/free-evaluation/book", label: "Or get evaluated first →" },
  },
];

export default function IntentChooser() {
  function pick(intentId: string, label: string, href: string) {
    trackEvent("cta_click", {
      label: `intent_${intentId}`,
      section: "intent_chooser",
      destination: href,
    });
  }

  return (
    <section
      id="start"
      className="bg-ngpa-deep py-14 sm:py-20 px-4 sm:px-6 lg:px-10 scroll-mt-20"
      aria-label="Where to start"
    >
      <div className="max-w-6xl mx-auto">
        <p className="font-heading text-sm sm:text-base font-bold text-ngpa-teal tracking-tight text-center mb-3">
          Start here
        </p>
        <h2 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white text-center tracking-tight">
          Where are you in the journey?
        </h2>
        <p className="text-ngpa-white/70 text-center mt-3 max-w-xl mx-auto">
          Three doors, one right for you. Pick the one that fits and
          we&rsquo;ll take it from there.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {INTENTS.map((intent) => (
            <div
              key={intent.id}
              className="rounded-2xl bg-ngpa-panel/80 border border-ngpa-slate/60 p-6 sm:p-7 flex flex-col hover:border-ngpa-teal/50 transition-colors"
            >
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-ngpa-teal">
                {intent.eyebrow}
              </p>
              <h3 className="font-heading text-xl font-black text-ngpa-white mt-2 tracking-tight">
                {intent.title}
              </h3>
              <p className="text-ngpa-white/70 text-sm mt-3 leading-relaxed flex-1">
                {intent.body}
              </p>
              <div className="mt-6 space-y-3">
                <Link
                  href={intent.primary.href}
                  onClick={() =>
                    pick(intent.id, intent.primary.label, intent.primary.href)
                  }
                  className="block text-center px-6 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors min-h-[48px]"
                >
                  {intent.primary.label}
                </Link>
                <Link
                  href={intent.secondary.href}
                  onClick={() =>
                    pick(
                      intent.id,
                      intent.secondary.label,
                      intent.secondary.href,
                    )
                  }
                  className="block text-center text-sm text-ngpa-teal-bright hover:text-ngpa-teal font-semibold transition-colors"
                >
                  {intent.secondary.label}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
