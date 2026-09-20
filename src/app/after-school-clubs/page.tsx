import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { orgRef } from "@/lib/seo";
import {
  EC_PARTNER_NAME,
  EC_PARTNER_URL,
  EC_REGISTRATION_NOTE,
  ecClubPublicVenue,
  ecPublicClubs,
  ecRemainingDates,
  type EcClub,
} from "@/data/enrichment-collective";

const TITLE = "After-School Pickleball Clubs — Montgomery County, MD";
const DESCRIPTION =
  "Coach Sam runs weekly after-school pickleball clubs at five Montgomery County elementary schools. See the days, schools and dates, and register through Enrichment Collective.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/after-school-clubs" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/after-school-clubs",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/**
 * Eastern-calendar "today" as a date-only ISO string. Deliberately not
 * `new Date(y, m, d)` — that reads the build server's UTC clock and this repo
 * has been bitten by it. `en-CA` formats as YYYY-MM-DD.
 */
function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function formatSessionDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function ClubCard({ club, todayIso }: { club: EcClub; todayIso: string }) {
  const remaining = ecRemainingDates(club, todayIso);
  const time =
    club.startTime && club.endTime ? `${club.startTime} – ${club.endTime}` : null;

  return (
    <li className="rounded-2xl bg-ngpa-panel p-6 ring-1 ring-white/5">
      <p className="font-mono text-sm uppercase tracking-wide text-ngpa-lime">
        {club.weekdayLabel}
        {time ? ` · ${time}` : " · time to be announced"}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-white">
        {ecClubPublicVenue(club)}
      </h3>

      <p className="mt-4 text-sm font-medium text-white/70">
        {remaining.length} session{remaining.length === 1 ? "" : "s"} left
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {remaining.map((date) => (
          <li
            key={date}
            className="rounded-md bg-ngpa-slate px-2 py-1 font-mono text-xs text-white/80"
          >
            <time dateTime={date}>{formatSessionDate(date)}</time>
          </li>
        ))}
      </ul>

      <a
        href={club.registrationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ngpa-lime px-6 py-3 font-semibold text-ngpa-black transition hover:brightness-110"
      >
        Register for the rest of the season
      </a>
      <p className="mt-2 text-xs text-white/50">
        Opens {EC_PARTNER_NAME}, who run registration for this club.
      </p>
    </li>
  );
}

export default function AfterSchoolClubsPage() {
  const todayIso = todayEastern();
  const clubs = ecPublicClubs(todayIso);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: "https://nextgenpbacademy.com/after-school-clubs",
          publisher: orgRef(),
        }}
      />

      <main className="bg-ngpa-navy">
        <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
          <h1 className="text-3xl font-bold text-white sm:text-5xl">
            After-school pickleball clubs
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            Coach Sam runs a weekly club at five Montgomery County elementary
            schools this fall. Kids play right after dismissal — no equipment
            needed, every level welcome.
          </p>

          {clubs.length === 0 ? (
            <div className="mt-12 rounded-2xl bg-ngpa-panel p-6 ring-1 ring-white/5">
              <p className="text-white/80">
                This season&apos;s clubs have finished. New clubs are scheduled
                each term —{" "}
                <a
                  href={EC_PARTNER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ngpa-lime underline"
                >
                  check {EC_PARTNER_NAME}
                </a>{" "}
                for what is open now.
              </p>
            </div>
          ) : (
            <ul className="mt-12 grid gap-6 sm:grid-cols-2">
              {clubs.map((club) => (
                <ClubCard key={club.key} club={club} todayIso={todayIso} />
              ))}
            </ul>
          )}

          <div className="mt-12 rounded-2xl bg-ngpa-slate p-6 ring-1 ring-white/5">
            <h2 className="text-lg font-semibold text-white">
              How registration works
            </h2>
            <p className="mt-3 text-white/70">{EC_REGISTRATION_NOTE}</p>
            <p className="mt-3 text-white/70">
              Clubs meet at the school your child already attends, so there is
              no pickup to arrange in between. Ask the front office if you are
              not sure whether your school is taking sign-ups.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
