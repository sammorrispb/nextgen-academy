import type { BallColor } from "./levels";

/**
 * A Block is a 4-week cohort of a single ball-color group at a specific
 * day/time/location. Blocks are the unit of re-registration: families commit
 * 4 weeks at a time and decide whether to extend at the end of the block.
 *
 * Today this list is maintained by hand. Once a block cycle is codified,
 * we can generate it programmatically.
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
  startDate: string;
  endDate: string;
  sessionCount: number;
  reregisterUrl: string;
  nextBlockStartDate: string;
  nextBlockPriceUsd: number;
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
  // Example placeholder — replace with the real Spring 2026 blocks before
  // enabling the cron. Keeping one example in the file documents the shape.
  {
    id: "2026-04-green-mon-5pm-moco",
    level: "green",
    label: "Green Ball — Mondays 5pm",
    location: "Montgomery County",
    dayOfWeek: "Monday",
    timeSlot: "5:00–6:00 PM",
    startDate: "2026-04-06",
    endDate: "2026-04-27",
    sessionCount: 4,
    reregisterUrl: "https://nextgenpbacademy.com/schedule",
    nextBlockStartDate: "2026-05-04",
    nextBlockPriceUsd: 140,
    participants: [],
    remindersSent: [],
  },
];
