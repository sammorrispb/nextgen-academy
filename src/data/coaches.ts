export interface Coach {
  name: string;
  role: string;
  initials: string;
  initialsBg: string;
  bio: string;
  highlights: string[];
}

export const coaches: Coach[] = [
  {
    name: "Sam Morris",
    role: "Head Coach & Co-Founder",
    initials: "SM",
    initialsBg: "#DC2626",
    bio: "Sam is a former physical education teacher and father to two boys, Kobe and Owen. As Director of Pickleball Programming at Dill Dinkers (North Bethesda and Rockville), he's been playing since 2019 and coaching since 2021. Sam and his son Kobe spend hours each week throwing, catching, chasing, and playing — this purposeful play helped Kobe start pickleball at age 5, playing full games.",
    highlights: [
      "Director of Pickleball Programming, Dill Dinkers",
      "Former physical education teacher",
      "Playing since 2019, coaching since 2021",
    ],
  },
  {
    name: "Amine",
    role: "Co-Founder & Coach",
    initials: "A",
    initialsBg: "#EA580C",
    bio: "Co-founder of Next Gen Pickleball Academy, Amine brings a passion for youth development and competitive play. Together with Sam, he's building a pathway where families grow through the sport.",
    highlights: [
      "Co-Founder, Next Gen Pickleball Academy",
      "Youth development advocate",
    ],
  },
];
