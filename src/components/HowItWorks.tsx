import { EVALUATION_SMS_URL } from "@/data/scheduling";
import TrackedCTA from "@/components/TrackedCTA";
import Link from "next/link";

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
        30 minutes on court. Your coach watches your child play, then places
        them at the right ball color &mdash; Red, Orange, Green, or Yellow &mdash;
        then recommends a program that fits their skills, age and your
        schedule. Private lessons are available at any level.
      </>
    ),
  },
  {
    number: "2",
    title: "Choose your program",
    body: (
      <>
        Try a single drop-in when one is listed, or join a season paid up front
        for a regular group. Partner classes have their own dates, ages and
        registration. Each listing explains what you&rsquo;re signing up for.{" "}
        <Link href="/league" className="font-bold text-ngpa-teal underline hover:text-ngpa-teal-bright">
          See leagues and seasons
        </Link>.
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

/** The section's title. The home page shows it as the label of the fold. */
export const HOW_IT_WORKS_TITLE = "Three steps onto the pathway.";

/** The three steps and their evaluation link. The home page wraps this in a
 * fold that carries the `how-it-works` anchor and the heading. */
export default function HowItWorks() {
  return (
    <>
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
            href={EVALUATION_SMS_URL}
            label="how_it_works_book_eval"
            section="how_it_works"
            asNextLink
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-ngpa-teal text-ngpa-deep font-bold rounded-full hover:bg-ngpa-teal-bright transition-colors text-base shadow-lg shadow-ngpa-teal/20 min-h-[48px]"
          >
            Text for a Free Evaluation
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
    </>
  );
}
