import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Bethesda, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for kids ages 5–16 in Bethesda, MD. Free 30-min evaluations, small-group sessions, and private lessons from Next Gen Academy.";

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
      intro="Next Gen Pickleball Academy coaches kids ages 5–16 from Bethesda and the surrounding MoCo neighborhoods. Group sessions for kids 8+ who can rally, and private lessons for ages 5–7 (and any 8+ still learning the rally) — a clear pathway from first paddle touch to tournament play. Start with a free 30-minute evaluation."
      whereWePlay="We serve players from Bethesda and surrounding MoCo neighborhoods at our rotating MCPS locations across Montgomery County — including Walter Johnson HS, Gaithersburg, and Sherwood-cluster venues. The court that's closest to you depends on what's open for the week."
    />
  );
}
