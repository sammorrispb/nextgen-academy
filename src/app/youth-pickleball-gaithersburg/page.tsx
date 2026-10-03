import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";
import { MVF_AGE_MIN, MVF_AGE_MAX, NORTH_CREEK } from "@/data/mvf";

const TITLE = "Youth Pickleball in Gaithersburg, MD — Next Gen Academy";
const DESCRIPTION =
  `Youth pickleball for Gaithersburg families. Explore MVF classes in Montgomery Village (ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}), evaluations and lessons. MVF handles class registration.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/youth-pickleball-gaithersburg" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://nextgenpbacademy.com/youth-pickleball-gaithersburg",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function GaithersburgPage() {
  return (
    <CityLanding
      city="Gaithersburg"
      slug="youth-pickleball-gaithersburg"
      intro={`Gaithersburg families can explore MVF partner classes in Montgomery Village for ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}. The fall classes list ${NORTH_CREEK.name}; you register and pay through MVF, choosing the session and skill bracket that fits. NGA's academy serves ages 6–16, with free evaluations and private lessons available as other starting points.`}
      whereWePlay={`${NORTH_CREEK.name} at ${NORTH_CREEK.center} is in ${NORTH_CREEK.locality}, rather than Gaithersburg. Confirm the class venue with MVF before heading out: Watkins Mill is a contingency if court work moves a class. Our 2026 summer camps at Gaithersburg High School ran earlier this year, and Ridgeview Middle School hosted sessions in past seasons. Those are history, not a promise of current camp or weekly availability. Coach Sam confirms evaluation and lesson courts.`}
      programLink={{ label: "MVF class details and registration", href: "/montgomery-village-youth-pickleball" }}
      cityFaq={[{
        question: "Which programs can Gaithersburg families explore now?",
        answer: `See /montgomery-village-youth-pickleball for MVF classes, ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}, at ${NORTH_CREEK.name} in ${NORTH_CREEK.locality}. MVF handles registration and payment; confirm the listed venue and available session with MVF. Gaithersburg High School camps and Ridgeview sessions are past programs. Evaluations or private lessons are arranged with Coach Sam.`,
      }]}
    />
  );
}
