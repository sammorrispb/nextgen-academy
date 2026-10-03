import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";

const TITLE = "Youth Pickleball in Silver Spring, MD — Next Gen Academy";
const DESCRIPTION =
  "Youth pickleball for Silver Spring families. Explore county programs, evaluations and lessons. Each listing gives its venue, ages and levels.";

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
      intro={"Silver Spring families have trained with us at Odessa Shannon Middle School in past seasons. To choose an option now, compare the county's listed programs or start with a free 30-minute evaluation or private lesson. NGA's academy serves ages 6–16; program listings set their own eligibility and registration terms."}
      whereWePlay={"Odessa Shannon Middle School evenings and Earle B. Wood Middle School Saturday sessions are past programs. The county guide links to the Green and Yellow Ball season at Walter Johnson High School in Bethesda and MVF classes in Montgomery Village. Check each program's dates, ages, levels and registration owner. Coach Sam confirms the court for evaluations and private lessons. The crew-interest form records interest in a future Silver Spring program."}
      programLink={{ label: "Compare county programs", href: "/montgomery-county-youth-pickleball#programs" }}
      cityFaq={[{
        question: "Have you run sessions in Silver Spring?",
        answer: "Yes. Odessa Shannon Middle School hosted sessions in past seasons. For listed options now, compare the county programs and their actual venues rather than assume those school sessions are still running. Use the crew-interest form for a future Silver Spring program, or arrange an evaluation or private lesson with Coach Sam, who confirms the court.",
      }]}
    />
  );
}
