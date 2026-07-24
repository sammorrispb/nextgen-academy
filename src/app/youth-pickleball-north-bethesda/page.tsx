import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in North Bethesda, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in North Bethesda, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

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
      intro="For North Bethesda families, our Sunday-evening group sessions at Walter Johnson High School are just a few minutes away — a court for every level, Red through Yellow, for kids 6–16. Start with a free 30-minute evaluation and we'll place your child by skill, not just age, then you drop in session by session with no subscription."
      whereWePlay="Walter Johnson HS on Rock Spring Drive, off the I-270 spur, is the close option from North Bethesda. Earle B. Wood Middle School in Rockville hosts the Saturday evenings a short drive up the Pike. Both venues run the same format — one court per level, capped at four players per court so every kid gets reps."
      cityFaq={[
        {
          question: "Which venue is closest to North Bethesda?",
          answer:
            "Walter Johnson High School (6400 Rock Spring Dr, Bethesda), home of this season's Sunday-evening sessions, sits just off the I-270 spur minutes from North Bethesda. Saturdays run at Earle B. Wood Middle School in Rockville. Check the schedule page for this week's slots.",
        },
      ]}
    />
  );
}
