import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";
import { FALL_SEASON_LABEL, FALL_VENUE_SHORT } from "@/data/fall-2026";
import { FALL_SEASON_GROUPS } from "@/data/fall-season-2026";

const GROUPS = FALL_SEASON_GROUPS.map((group) => group.label).join(" and ");

const TITLE = "Youth Pickleball in Bethesda, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Bethesda, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

export const metadata: Metadata = {
  // `absolute` skips the "%s | Next Gen Pickleball Academy" template so the
  // rendered <title> stays under the 60-char Google truncation budget.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-bethesda" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-bethesda",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function BethesdaPage() {
  return (
    <CityLanding
      city="Bethesda"
      slug="youth-pickleball-bethesda"
      intro={`Bethesda's fall 2026 program is a six-Sunday season at ${FALL_VENUE_SHORT}, ${FALL_SEASON_LABEL}, for ${GROUPS}. Registration covers the full season, paid up front. New to pickleball or looking for Red or Orange Ball? Start with a free 30-minute evaluation or a private lesson, and we'll help you find a program that fits your player.`}
      whereWePlay={`${FALL_VENUE_SHORT} on Rock Spring Drive hosts the 2026 fall season. We've also coached at Westland Middle School and Earle B. Wood Middle School in past seasons. Check fall season details for current availability and the drop-in schedule for separately listed single sessions; ages, levels and group sizes depend on the program.`}
      programLink={{ label: "Fall season details", href: "/fall" }}
      cityFaq={[
        {
          question: "Where do Bethesda kids play with Next Gen?",
          answer:
            `${FALL_VENUE_SHORT} (6400 Rock Spring Dr) hosts the six-Sunday fall 2026 season for ${GROUPS}, ${FALL_SEASON_LABEL}. This is a season registration, not a weekly drop-in. See /fall for its current status. Private lessons and free evaluations are arranged with Coach Sam; the /schedule page lists any separate drop-in sessions.`,
        },
      ]}
    />
  );
}
