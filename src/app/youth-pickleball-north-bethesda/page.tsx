import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";
import { FALL_SEASON_LABEL, FALL_VENUE_SHORT } from "@/data/fall-2026";
import { FALL_SEASON_GROUPS } from "@/data/fall-season-2026";

const GROUPS = FALL_SEASON_GROUPS.map((group) => group.label).join(" and ");

const TITLE = "Youth Pickleball in North Bethesda, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for North Bethesda families. Compare Bethesda seasons, evaluations and lessons. Check each program's ages, levels and registration.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-north-bethesda" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-north-bethesda",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function NorthBethesdaPage() {
  return (
    <CityLanding
      city="North Bethesda"
      slug="youth-pickleball-north-bethesda"
      intro={`For North Bethesda families, compare the 2026 fall season at ${FALL_VENUE_SHORT} in Bethesda for ${GROUPS}. Registration covers the full season, paid up front. It is separate from single-session drop-ins when those are listed. For Red or Orange Ball, start with a free 30-minute evaluation or request a private lesson. Check the program's ages, dates and current availability before registering.`}
      whereWePlay={`${FALL_VENUE_SHORT} (6400 Rock Spring Dr, Bethesda) hosts the ${FALL_SEASON_LABEL} season. Earle B. Wood Middle School in Rockville hosted Saturday sessions in past seasons; those earlier sessions are not a current North Bethesda venue. Coach Sam confirms the court for evaluations and private lessons.`}
      programLink={{ label: "Fall season details", href: "/fall" }}
      cityFaq={[{
        question: "Which program can North Bethesda families explore?",
        answer: `The 2026 fall season at ${FALL_VENUE_SHORT} in Bethesda is for ${GROUPS}, ${FALL_SEASON_LABEL}. Registration covers the full season, paid up front. See /fall for current status and terms; separately listed drop-ins appear on /schedule. For evaluations or lessons, Coach Sam confirms the time and court.`,
      }]}
    />
  );
}
