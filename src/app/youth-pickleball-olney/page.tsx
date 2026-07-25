import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Olney, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Olney, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-olney" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-olney",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function OlneyPage() {
  return (
    <CityLanding
      city="Olney"
      slug="youth-pickleball-olney"
      intro="Olney is minutes from our Saturday home: Earle B. Wood Middle School on Bauer Drive, a quick drive down Georgia Avenue from Olney, hosts this season's Saturday-evening group sessions with a court for every level — Red, Orange, Green, and Yellow. We've run Tuesday evenings on the Olney side in past seasons too. Kids 6–16 start with a free 30-minute evaluation."
      whereWePlay="Wood MS is the closest regular venue for Olney families, and the August back-to-school camp runs there as well. Sunday evenings run at Walter Johnson HS in Bethesda. Same format everywhere: one court per level, capped at four players per court, pay per session with no subscription."
      cityFaq={[
        {
          question: "What's the closest venue to Olney?",
          answer:
            "Earle B. Wood Middle School (14615 Bauer Dr, Rockville) — a quick drive down Georgia Avenue from Olney — hosts this season's Saturday-evening sessions and the August back-to-school camp. Venues can shift season to season, so check the schedule page for this week's slots.",
        },
      ]}
    />
  );
}
