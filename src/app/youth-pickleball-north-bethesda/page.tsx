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
      intro="Next Gen Pickleball Academy coaches kids ages 6–16 from North Bethesda and the surrounding MoCo neighborhoods. Small-group sessions for kids who can rally, and private lessons for anyone still learning — a clear pathway from first paddle touch to tournament play. Start with a free 30-minute evaluation."
      whereWePlay="We serve players from North Bethesda and surrounding MoCo neighborhoods at our rotating MCPS locations across Montgomery County — including Walter Johnson HS, Gaithersburg, and Sherwood-cluster venues. The court that's closest to you depends on what's open for the week."
    />
  );
}
