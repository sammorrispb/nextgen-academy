import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Gaithersburg, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Gaithersburg, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-gaithersburg" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-gaithersburg",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function GaithersburgPage() {
  return (
    <CityLanding
      city="Gaithersburg"
      slug="youth-pickleball-gaithersburg"
      intro="Gaithersburg is home turf for our summer camps — this year's June and July camp weeks ran at Gaithersburg High School — and our fall MVF classes run next door in Montgomery Village. This season's weekly group sessions for kids 6–16 run on weekend evenings at Earle B. Wood MS in Rockville and Walter Johnson HS in Bethesda. Start with a free 30-minute evaluation."
      whereWePlay="We've coached Gaithersburg kids at Ridgeview Middle School in past seasons, run summer camp weeks at Gaithersburg High School, and teach fall classes at Apple Ridge in Montgomery Village. The current weekend sessions run at Wood MS (Saturdays) and Walter Johnson HS (Sundays) — one court per level, four players per court."
      cityFaq={[
        {
          question: "Do you run anything in Gaithersburg itself?",
          answer:
            "Yes — our summer camp weeks run at Gaithersburg High School, and our fall MVF classes run at Apple Ridge in Montgomery Village next door. The weekly weekend group sessions currently run in Rockville (Saturdays) and Bethesda (Sundays) — the schedule page has the current lineup.",
        },
      ]}
    />
  );
}
