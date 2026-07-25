import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Potomac, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Potomac, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

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
      intro="Most Potomac families join our Sunday-evening group sessions at Walter Johnson High School — on Rock Spring Drive near the Montgomery Mall area — where every level from Red to Yellow gets its own court. Kids 6–16 start with a free 30-minute evaluation, then drop in session by session with no subscription or commitment."
      whereWePlay="Walter Johnson HS is the closest regular venue from Potomac; Saturday evenings run at Earle B. Wood Middle School in Rockville. Summer camp weeks run in Gaithersburg, and if your child wants 1:1 work before joining a group, ask about private lessons at your evaluation — we'll figure out what works for your family."
      cityFaq={[
        {
          question: "What's the closest venue to Potomac?",
          answer:
            "Walter Johnson High School (6400 Rock Spring Dr, Bethesda), near the Montgomery Mall area, hosts this season's Sunday-evening sessions and is the closest regular venue for most Potomac families. Saturdays run at Earle B. Wood MS in Rockville — check the schedule page for current slots.",
        },
      ]}
    />
  );
}
