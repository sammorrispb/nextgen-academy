import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Silver Spring, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Silver Spring, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-silver-spring" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-silver-spring",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function SilverSpringPage() {
  return (
    <CityLanding
      city="Silver Spring"
      slug="youth-pickleball-silver-spring"
      intro="Silver Spring families have trained with us at Odessa Shannon Middle School in past seasons. This season's group sessions for kids 6–16 run on weekend evenings at Earle B. Wood Middle School in Rockville — an easy ride up Layhill or Norbeck from north Silver Spring — and Walter Johnson High School in Bethesda. Start with a free 30-minute evaluation."
      whereWePlay="From most of Silver Spring, Wood MS on Bauer Drive is the closer weekend venue; down-county families may find the Bethesda Sundays easier. We've run Silver Spring evenings before — if your family wants sessions back on this side of the county, the crew-interest form is how that happens."
      cityFaq={[
        {
          question: "Have you run sessions in Silver Spring?",
          answer:
            "Yes — past seasons included weekly evenings at Odessa Shannon Middle School in Silver Spring. This season's group sessions run at Earle B. Wood MS in Rockville and Walter Johnson HS in Bethesda; check the schedule page for current slots, and use the crew-interest form if you'd like Silver Spring sessions back.",
        },
      ]}
    />
  );
}
