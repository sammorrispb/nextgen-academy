import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";
import { FALL_SEASON_LABEL, FALL_VENUE_SHORT } from "@/data/fall-2026";
import { FALL_SEASON_GROUPS } from "@/data/fall-season-2026";

const GROUPS = FALL_SEASON_GROUPS.map((group) => group.label).join(" and ");

const TITLE = "Youth Pickleball in Potomac, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for Potomac families. Compare Bethesda seasons, evaluations and lessons. Check each program's ages, levels and registration.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-potomac" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-potomac",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PotomacPage() {
  return (
    <CityLanding
      city="Potomac"
      slug="youth-pickleball-potomac"
      intro={`For Potomac families, the 2026 fall season at ${FALL_VENUE_SHORT} in Bethesda is for ${GROUPS}. Registration covers the full season, paid up front. New players or families looking for Red or Orange Ball can start with a free 30-minute evaluation or a private lesson; each program lists its ages and levels.`}
      whereWePlay={`${FALL_VENUE_SHORT} (6400 Rock Spring Dr, Bethesda) hosts the ${FALL_SEASON_LABEL} season. Earlier Earle B. Wood Middle School sessions and Gaithersburg summer camps are past programs. Check the fall listing for current availability and the schedule for separately listed drop-ins. Coach Sam confirms the court for evaluations and private lessons.`}
      programLink={{ label: "Fall season details", href: "/fall" }}
      cityFaq={[{
        question: "Where can Potomac families join a season?",
        answer: `The 2026 fall season at ${FALL_VENUE_SHORT} is in Bethesda, for ${GROUPS}, ${FALL_SEASON_LABEL}. It is a full season, paid up front, rather than weekly drop-in registration. Check /fall for current availability and terms. Coach Sam confirms the time and court for evaluations or private lessons.`,
      }]}
    />
  );
}
