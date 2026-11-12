import { site } from "./site";

/** Parent-facing entry points. No child or payment details cross sites. */
export const EVALUATION_SMS_URL = `sms:+1${site.phone.replace(/\D/g, "")}`;

// Lesson requests are taken on Coach Sam's scheduling site, which lives on
// linkanddink.com. Link to it directly: the old coach subdomain of
// sammorrispb.com only redirects here, so going through it costs a hop and
// lands the parent on a domain the link never named. One origin feeds every
// lesson link so they move together (e2e/lesson-handoff.spec.ts scans src for
// the old host).
export const COACH_LESSONS_ORIGIN = "https://coach.linkanddink.com";
export const NGA_LESSON_REQUEST_URL = `${COACH_LESSONS_ORIGIN}/book/nga-lessons`;
export const ADULT_LESSON_REQUEST_URL = `${COACH_LESSONS_ORIGIN}/book/private-lesson`;

/** The on-site route that forwards a parent to NGA_LESSON_REQUEST_URL. */
export const LESSON_REQUEST_PATH = "/lessons/book";

/**
 * Shown with every in-body lesson link (rendered by LessonHandoffLink, never
 * typed beside a link by hand) so a parent knows the tap leaves this site.
 * Draft wording; Sam finalizes it.
 */
export const LESSON_HANDOFF_LINE = "Opens the lesson request page on linkanddink.com.";

const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function lessonSchedulingUrl(params: Record<string, string | string[] | undefined> = {}): string {
  const url = new URL(NGA_LESSON_REQUEST_URL);
  for (const key of CAMPAIGN_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim() && value.length <= 200) {
      url.searchParams.set(key, value.trim());
    }
  }
  return url.toString();
}
