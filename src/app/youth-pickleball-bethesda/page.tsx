import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

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
      intro="Bethesda is one of our home bases: this season's Sunday-evening group sessions run at Walter Johnson High School on Rock Spring Drive, with a court for every level — Red, Orange, Green, and Yellow. Kids 6–16 from Bethesda and Chevy Chase start with a free 30-minute evaluation, then drop in at the level that fits — no subscription, no long-term commitment."
      whereWePlay="Walter Johnson HS is the closest regular venue for most Bethesda families, and we've also coached Bethesda kids at Westland Middle School in past seasons. Saturday evenings run at Earle B. Wood Middle School in Rockville if that end of the weekend works better for your crew — same format at both: one court per level, four players per court."
      cityFaq={[
        {
          question: "Where do Bethesda kids play with Next Gen?",
          answer:
            "This season's Sunday group sessions run at Walter Johnson High School (6400 Rock Spring Dr) right in Bethesda, with Saturday sessions at Earle B. Wood Middle School in Rockville. Venues can shift season to season, so check the schedule page for this week's exact slots.",
        },
      ]}
    />
  );
}
