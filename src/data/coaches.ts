export interface Coach {
  name: string;
  role: string;
  initials: string;
  initialsBg: string;
  photo?: string;
  bio: string;
  /** One-line credential summary for the homepage CoachStrip (above-the-fold trust signal). */
  tagline: string;
  highlights: string[];
  specialty?: string;
  /** Structured credentials for Person JSON-LD (schema.org knowsAbout) */
  knowsAbout?: string[];
}

export const coaches: Coach[] = [
  {
    name: "Sam Morris",
    role: "Head Coach & Co-Founder",
    initials: "SM",
    initialsBg: "#FF4040",
    photo: "/images/coach-sam.jpeg",
    bio: "Sam is a former physical education teacher and father to two boys, Kobe and Owen. He's been playing pickleball since 2019 and coaching since 2021. Sam and his son Kobe spend hours each week throwing, catching, chasing, and playing — this purposeful play helped Kobe start pickleball at age 5, playing full games.",
    tagline: "Former PE teacher · Dad of two · Coaching since 2021",
    highlights: [
      "Co-Founder, Next Gen Pickleball Academy",
      "Former physical education teacher",
      "Playing since 2019, coaching since 2021",
    ],
    knowsAbout: [
      "Pickleball",
      "Youth Sports Coaching",
      "USA Pickleball Youth Progression",
      "Physical Education",
    ],
  },
  {
    name: "Amine Lahlou",
    role: "Co-Founder & Coach",
    initials: "A",
    initialsBg: "#FF8C00",
    bio: "Moroccan-born professional tennis player and coach turned pickleball convert, Amine brings elite racket sport fundamentals to every session. A 4.0+ pickleball player himself, he trains alongside his son Ryan\u2014a Next Gen athlete\u2014and channels that father-son dynamic into everything he teaches. Dad of three, Amine understands the family side of youth sports from the inside out.",
    tagline: "Former pro tennis player \u00b7 Dad of three \u00b7 4.0+ pickleball",
    highlights: [
      "Former professional tennis player and coach",
      "4.0+ pickleball player | trains alongside son Ryan",
      "Dad of 3 \u2014 brings the family perspective to every session",
    ],
    specialty: "Racket Sport Fundamentals & Family Development",
    knowsAbout: [
      "Pickleball",
      "Tennis",
      "Youth Sports Coaching",
      "Racket Sport Fundamentals",
    ],
  },
];
