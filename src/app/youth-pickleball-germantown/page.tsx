import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Germantown, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 6–16 in Germantown, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-germantown" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-germantown",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function GermantownPage() {
  return (
    <CityLanding
      city="Germantown"
      slug="youth-pickleball-germantown"
      intro="Germantown kids 6–16 train with us at venues a straight shot down I-270 — Sunday evenings at Walter Johnson High School in Bethesda, Saturdays at Earle B. Wood Middle School in Rockville — plus summer camp weeks in nearby Gaithersburg. Start with a free 30-minute evaluation and we'll find the slot that fits your drive."
      whereWePlay="The closest options from Germantown are usually the Gaithersburg summer camps and the fall classes at Apple Ridge in Montgomery Village; the weekly group sessions run down-county on weekend evenings. Venue lineups change seasonally based on where families are — if enough Germantown families want a closer crew, tell us on the crew-interest form."
      cityFaq={[
        {
          question: "Is there anything closer to Germantown?",
          answer:
            "The Gaithersburg camp weeks and the Montgomery Village fall classes are the closest programs today; weekly group sessions currently run down-county in Rockville and Bethesda on weekend evenings. If your family wants a Germantown-side crew, the Find Your Kid's Crew form is exactly how new venues get started.",
        },
      ]}
    />
  );
}
