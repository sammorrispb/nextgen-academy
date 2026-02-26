export interface Coach {
  name: string;
  role: string;
  initials: string;
  initialsBg: string;
  bio: string;
  highlights: string[];
  specialty?: string;
}

export const coaches: Coach[] = [
  {
    name: "Sam Morris",
    role: "Head Coach & Co-Founder",
    initials: "SM",
    initialsBg: "#FF4040",
    bio: "Sam is a former physical education teacher and father to two boys, Kobe and Owen. As Director of Pickleball Programming at Dill Dinkers (North Bethesda and Rockville), he's been playing since 2019 and coaching since 2021. Sam and his son Kobe spend hours each week throwing, catching, chasing, and playing — this purposeful play helped Kobe start pickleball at age 5, playing full games.",
    highlights: [
      "Director of Pickleball Programming, Dill Dinkers",
      "Former physical education teacher",
      "Playing since 2019, coaching since 2021",
    ],
  },
  {
    name: "Amine Lahlou",
    role: "Co-Founder & Coach",
    initials: "A",
    initialsBg: "#FF8C00",
    bio: "Moroccan-born professional tennis player and coach turned pickleball convert, Amine brings elite racket sport fundamentals to every session. A 4.0+ pickleball player himself, he trains alongside his son Ryan\u2014a Next Gen athlete\u2014and channels that father-son dynamic into everything he teaches. Dad of three, Amine understands the family side of youth sports from the inside out.",
    highlights: [
      "Former professional tennis player and coach",
      "4.0+ pickleball player | trains alongside son Ryan",
      "Dad of 3 \u2014 brings the family perspective to every session",
    ],
    specialty: "Racket Sport Fundamentals & Family Development",
  },
];
