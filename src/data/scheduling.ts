import { site } from "./site";

/** Parent-facing entry points. No child or payment details cross sites. */
export const EVALUATION_SMS_URL = `sms:+1${site.phone.replace(/\D/g, "")}`;
export const NGA_LESSON_REQUEST_URL = "https://coach.sammorrispb.com/book/nga-lessons";

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
