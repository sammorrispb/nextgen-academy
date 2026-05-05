import type { BallColor } from "./levels";

/**
 * A Block is one calendar month of programming for a single ball-color group at
 * a specific day/time/location. Pricing is $35/session, billed monthly via
 * Stripe Subscription. The cron sends a "next month at NGA" recap email a few
 * days before the 1st so families know what's coming + what'll be charged.
 *
 * Today this list is maintained by hand. Once the registration app's
 * `enrollments` table is live, generate this from active subscriptions.
 */
export interface BlockParticipant {
  parentName: string;
  childFirstName: string;
  email: string | null;
  phone: string | null;
}

export interface Block {
  id: string;
  level: BallColor;
  label: string;
  location: string;
  dayOfWeek:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  timeSlot: string;
  startDate: string;              // first day of this month's block
  endDate: string;                // last day of this month's block
  sessionCount: number;           // sessions in this month (4 or 5 depending on the calendar)
  reregisterUrl: string;          // points to /account on the registration app
  nextBlockStartDate: string;     // first day of next month
  nextBlockSessionCount: number;  // sessions in next month (4 or 5 depending on the calendar)
  nextBlockPriceUsd: number;      // nextBlockSessionCount × $35
  participants: BlockParticipant[];
  /**
   * ISO dates of reminder sends already completed. Used to prevent duplicate
   * emails if the cron fires twice for the same threshold. Updated by the
   * cron handler via a manual PR — we intentionally keep this in code so the
   * source of truth stays reviewable.
   */
  remindersSent?: string[];
}

export const blocks: Block[] = [
  // Example placeholder documenting the monthly-block shape. Replace with real
  // active monthly cohorts (one entry per group per month) before enabling the
  // cron. nextBlockPriceUsd = sessionsInNextMonth × $35.
  {
    id: "2026-05-green-mon-5pm-moco",
    level: "green",
    label: "Green Ball — Mondays 5pm",
    location: "Montgomery County",
    dayOfWeek: "Monday",
    timeSlot: "5:00–6:00 PM",
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    sessionCount: 4, // 4 Mondays in May 2026
    reregisterUrl: "https://nextgenpbacademy.com/schedule",
    nextBlockStartDate: "2026-06-01",
    nextBlockSessionCount: 5, // 5 Mondays in June 2026
    nextBlockPriceUsd: 175, // 5 × $35
    participants: [],
    remindersSent: [],
  },
];
