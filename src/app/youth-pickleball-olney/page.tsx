import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Olney, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for Olney families. Explore county programs, evaluations and lessons. Each listing gives its venue, ages and levels.";

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
      intro={"Olney families can compare the county's listed seasons and partner classes, or start with a free 30-minute evaluation or private lesson. NGA's academy serves ages 6–16; each program has its own age and skill requirements. Earle B. Wood Middle School Saturdays and earlier Olney-area evenings are past programs."}
      whereWePlay={"Earle B. Wood Middle School in Rockville hosted Saturday sessions in past seasons, and its 2026 back-to-school camp has finished. For listed county options, compare the Green and Yellow Ball season at Walter Johnson High School in Bethesda with MVF classes in Montgomery Village. Season, partner-class and single-session drop-in terms differ; follow the actual program listing. Coach Sam confirms the court for evaluations and private lessons."}
      programLink={{ label: "Compare county programs", href: "/montgomery-county-youth-pickleball#programs" }}
      cityFaq={[{
        question: "Which options can Olney families explore?",
        answer: "Use the county guide to compare listed programs, including the Bethesda season and MVF classes in Montgomery Village. Past Wood Saturdays and the 2026 Wood camp do not establish current Olney availability. Check each program's venue, ages, levels and registration terms. Coach Sam confirms evaluation and private-lesson courts.",
      }]}
    />
  );
}
