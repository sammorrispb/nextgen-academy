import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Rockville, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Rockville, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-rockville" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-rockville",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RockvillePage() {
  return (
    <CityLanding
      city="Rockville"
      slug="youth-pickleball-rockville"
      intro="Rockville is where our Saturday evenings live: Earle B. Wood Middle School on Bauer Drive hosts this season's Saturday group sessions, with a court each for Red, Orange, Green, and Yellow Ball. Kids 6–16 start with a free 30-minute evaluation — we place by skill, every level is welcome, and you pay per session with no subscription."
      whereWePlay="Beyond the Wood MS Saturdays, Rockville families have trained with us at Redland Middle School near Derwood in past seasons, and our August back-to-school camp runs at Wood MS too. Sunday evenings run at Walter Johnson HS in Bethesda if that end of the weekend fits your family better."
      cityFaq={[
        {
          question: "Where in Rockville do sessions run?",
          answer:
            "This season's Saturday-evening group sessions run at Earle B. Wood Middle School (14615 Bauer Dr, Rockville), and the August back-to-school camp runs there as well. Sundays run at Walter Johnson HS in Bethesda. Venues can change seasonally — the schedule page always has the current lineup.",
        },
      ]}
    />
  );
}
