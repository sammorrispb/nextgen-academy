import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Rockville, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for Rockville families. Explore Montgomery County programs, evaluations and lessons. Each listing gives its venue, ages and levels.";

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
      intro={"Rockville families can compare the county's listed seasons and partner classes, or start with a free 30-minute evaluation or private lesson. NGA's academy serves ages 6–16; each program has its own ages, skill levels, venue and registration terms. Earle B. Wood Middle School hosted Saturday sessions in past seasons, rather than an ongoing weekly offer on this page."}
      whereWePlay={"We coached past seasons at Earle B. Wood Middle School in Rockville and Redland Middle School near Derwood. The 2026 back-to-school camp at Wood has finished. For listed county options, compare the Green and Yellow Ball season at Walter Johnson High School in Bethesda with MVF classes in Montgomery Village. Use the county guide for program status and booking details. Coach Sam confirms the court for evaluations and private lessons."}
      programLink={{ label: "Compare county programs", href: "/montgomery-county-youth-pickleball#programs" }}
      cityFaq={[{
        question: "Do past Wood sessions mean Rockville registration is open?",
        answer: "No. Earle B. Wood Middle School's Saturday sessions and 2026 back-to-school camp are past programs. The county guide lists season and partner-class options with their own venues, ages, levels and registration terms. Coach Sam confirms the time and court for an evaluation or private lesson; /schedule lists any separate single-session drop-ins.",
      }]}
    />
  );
}
