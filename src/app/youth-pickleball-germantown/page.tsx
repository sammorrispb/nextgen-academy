import type { Metadata } from "next";
import CityLanding from "@/components/CityLanding";
import { MVF_AGE_MIN, MVF_AGE_MAX, NORTH_CREEK } from "@/data/mvf";

const TITLE = "Youth Pickleball in Germantown, MD — Next Gen Academy";
const DESCRIPTION =
  `Youth pickleball for Germantown families. Explore MVF classes in Montgomery Village (ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}), evaluations and lessons. Check each program's eligibility.`;

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
      intro={`Germantown families can explore MVF classes in Montgomery Village for ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}, with separate activities by session and skill bracket. You register and pay through MVF. NGA's academy serves ages 6–16; a free 30-minute evaluation or private lesson can help your player find a suitable starting point.`}
      whereWePlay={`The fall MVF listings name ${NORTH_CREEK.name} at ${NORTH_CREEK.center} in ${NORTH_CREEK.locality}. Confirm the venue with MVF before attending; Watkins Mill is a contingency if court work moves a class. Bethesda's 2026 Green and Yellow Ball season is another county option, with full-season terms on /fall. Gaithersburg summer camps ran earlier in 2026. Coach Sam confirms evaluation and lesson courts. Share your interest in a future Germantown-area program through the crew-interest form.`}
      programLink={{ label: "MVF class details and registration", href: "/montgomery-village-youth-pickleball" }}
      extraNearby={[{ label: "Youth pickleball in Frederick", href: "/youth-pickleball-frederick" }]}
      cityFaq={[{
        question: "What can Germantown families compare?",
        answer: `Compare MVF classes at ${NORTH_CREEK.name} in ${NORTH_CREEK.locality}, ages ${MVF_AGE_MIN}–${MVF_AGE_MAX}, with the Bethesda season and the separate Frederick guide. MVF handles registration and payment; confirm its class venue and availability with MVF. The crew-interest form records interest in future programs; it does not register your child for an operating Germantown team.`,
      }]}
    />
  );
}
