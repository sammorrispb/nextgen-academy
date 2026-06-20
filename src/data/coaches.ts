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
    bio: "Tennis coach and lifelong racket sports enthusiast, Amine grew up playing tennis and ping pong, developing an elite foundation in hand-eye coordination and court strategy. His competitive drive led him to become a K-Swiss Ultimate Tennis Tampa Bay League Champion, reaching the elite 6.0 level in 2015. Now a passionate pickleball convert, he brings those top-tier racket sport fundamentals to every session. A 4.5+ pickleball player himself, he trains alongside his own son Ryan\u2014a Next Gen athlete\u2014so he coaches every kid the way he coaches his own: patient reps, steady encouragement, and real progress session to session. As a dad of three, Amine knows the family side of youth sports from the inside out, pairing high-level fundamentals with the patience and warmth a young player needs to keep showing up.",
    tagline: "Tennis coach \u00b7 Dad of three \u00b7 4.5+ pickleball",
    highlights: [
      "K-Swiss Ultimate Tennis Tampa Bay League Champion (6.0, 2015)",
      "4.5+ pickleball player | trains alongside son Ryan",
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
