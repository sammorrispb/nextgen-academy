// NGA lessons — the bookable private & group lesson products.
//
// PRICING SET BY SAM 2026-09-21: $60 for one hour, private and group alike.
//
// GROUP-LESSON PRICING BASIS — CONFIRMED BY SAM 2026-09-21: $60 TOTAL per
// group per hour, split between the players (NOT $60 per player). The
// Stripe price STRIPE_GROUP_LESSON_PRICE_ID is therefore the one-time $60
// total for the hour, charged quantity 1 regardless of group size; the form
// collects the player count and the checkout puts it in session metadata so
// staff see the per-player split. If the basis ever changes, this note, the
// page copy, and the Stripe price move together — never one without the
// other.

export const LESSON_DURATION_MINUTES = 60;
export const LESSON_PRICE_USD = 60;

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
    priceNote: "$60 per player, per hour",
  },
  group: {
    type: "group",
    title: "Group Lesson",
    slug: "group-lesson",
    priceEnvVar: "STRIPE_GROUP_LESSON_PRICE_ID",
    blurb:
      "One hour with a coach and a small group at your child's level. Real reps, real rallies, real coaching — and the $60 hour is split between the players, so it's the best value per player we offer.",
    bullets: [
      "60 minutes with a Next Gen coach and a small, level-matched group",
      "One price for the whole group: $60 for the hour, no matter the group size",
      "The $60 is split between the players — 4 players means $15 each",
      "Grouped by ball color (Red / Orange / Green / Yellow), never age alone",
      "High-rep drills plus live-ball play every session",
      "Bring a friend at the same level or we'll match your child into a group",
      "Scheduled around your family — weekdays, evenings, weekends",
    ],
    priceNote: "$60 per group, per hour — split between the players",
  },
};

export function findLessonProduct(
  type: string | undefined,
): LessonProduct | undefined {
  if (type === "private" || type === "group") return LESSON_PRODUCTS[type];
  return undefined;
}

/** Stripe checkout metadata kind for lesson purchases. */
export const LESSON_CHECKOUT_KIND = "lesson";
