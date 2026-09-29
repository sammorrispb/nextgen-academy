// NGA lessons — the bookable private & group lesson products.
//
// PRICING SET BY SAM 2026-09-29: a private lesson is $75 for the hour; a group
// lesson (semi-private or small group, 2–8 players) is $40 PER PLAYER for the
// hour, so a group of four is $160. This replaces the 2026-09-21 terms (one
// flat hourly rate for private and group alike, split between a group's
// players). The page, the cost FAQ, the home-page card and the legacy invoice
// route all read these constants — a price is changed here and nowhere else.
//
// Coach OS (community-os, the /book/nga-lessons program that /lessons/book
// forwards to) invoices the lessons requested through it and keeps its own
// copy of these terms. A price change here needs the same change there.

export const LESSON_DURATION_MINUTES = 60;
/** A private lesson: one player, one hour. */
export const PRIVATE_LESSON_PRICE_USD = 75;
/** A group lesson: charged per player, for the hour. */
export const GROUP_LESSON_PRICE_PER_PLAYER_USD = 40;

/** Group-lesson player-count bounds on the purchase form (adjustable). */
export const GROUP_LESSON_MIN_PLAYERS = 2;
export const GROUP_LESSON_MAX_PLAYERS = 8;

export type LessonType = "private" | "group";

export interface LessonProduct {
  type: LessonType;
  /** Parent-facing title. */
  title: string;
  slug: string;
  /** Env var holding the Stripe Price ID. Ships dark until set. */
  priceEnvVar: string;
  /** One-line pitch for cards. */
  blurb: string;
  /** Bullets for the lessons page. */
  bullets: string[];
  /** Headline price in dollars, quoted per `priceUnit`. */
  priceUsd: number;
  priceUnit: "hour" | "player";
  /** Pricing-basis note shown under the price. */
  priceNote: string;
}

export const LESSON_PRODUCTS: Record<LessonType, LessonProduct> = {
  private: {
    type: "private",
    title: "Private Lesson",
    slug: "private-lesson",
    priceEnvVar: "STRIPE_PRIVATE_LESSON_PRICE_ID",
    blurb:
      "One hour, one coach, one player. The fastest way to fix a stroke, build a serve, or get tournament-ready.",
    bullets: [
      "60 minutes of 1-on-1 coaching with a Next Gen coach",
      "Fully personalized: technique, tactics, or match play — your call",
      "Video feedback on key strokes when it helps",
      "Scheduled around your family — weekdays, evenings, weekends",
      "For any level, Red Ball through Yellow Ball",
    ],
    priceUsd: PRIVATE_LESSON_PRICE_USD,
    priceUnit: "hour",
    priceNote: "One player, per hour",
  },
  group: {
    type: "group",
    title: "Group Lesson",
    slug: "group-lesson",
    priceEnvVar: "STRIPE_GROUP_LESSON_PRICE_ID",
    blurb: `One hour with a coach and a small group at your child's level. Real reps, real rallies, real coaching — and at $${GROUP_LESSON_PRICE_PER_PLAYER_USD} per player, it's the best value per player we offer.`,
    bullets: [
      "60 minutes with a Next Gen coach and a small, level-matched group",
      `$${GROUP_LESSON_PRICE_PER_PLAYER_USD} per player for the hour, whatever the group size`,
      "Grouped by ball color (Red / Orange / Green / Yellow), never age alone",
      "High-rep drills plus live-ball play every session",
      "Bring a friend at the same level or we'll match your child into a group",
      "Scheduled around your family — weekdays, evenings, weekends",
    ],
    priceUsd: GROUP_LESSON_PRICE_PER_PLAYER_USD,
    priceUnit: "player",
    priceNote: `Per hour — a group of 4 is $${lessonTotalUsd("group", 4)}`,
  },
};

/**
 * What a lesson costs, in dollars: the private rate, or the per-player rate
 * times the group size. Throws on a group size the form can't produce, so a
 * bad count can never price an invoice.
 */
export function lessonTotalUsd(type: LessonType, groupPlayers?: number): number {
  if (type === "private") return PRIVATE_LESSON_PRICE_USD;
  if (
    groupPlayers === undefined ||
    !Number.isInteger(groupPlayers) ||
    groupPlayers < GROUP_LESSON_MIN_PLAYERS ||
    groupPlayers > GROUP_LESSON_MAX_PLAYERS
  ) {
    throw new RangeError(
      `A group lesson is ${GROUP_LESSON_MIN_PLAYERS}–${GROUP_LESSON_MAX_PLAYERS} players`,
    );
  }
  return GROUP_LESSON_PRICE_PER_PLAYER_USD * groupPlayers;
}

export function findLessonProduct(
  type: string | undefined,
): LessonProduct | undefined {
  if (type === "private" || type === "group") return LESSON_PRODUCTS[type];
  return undefined;
}

/** Stripe checkout metadata kind for lesson purchases. */
export const LESSON_CHECKOUT_KIND = "lesson";
