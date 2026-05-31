import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  fetchUpcomingDropIns,
  markDropInFlag,
  type DropInRegistration,
} from "@/lib/notion-dropins";
import { sessionToSlug } from "@/lib/session-slug";
import { signCancelToken } from "@/lib/cancel-token";
import { isWithinPreEventWindow } from "@/lib/session-time";
import {
  locationRevealHtml,
  locationRevealText,
} from "@/lib/email/location-reveal";

export const runtime = "nodejs";
// Cron path — never cache.
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextgenpbacademy.com";

function etPlusDaysIso(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

function formatLongDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function revealOne(
  resend: Resend | null,
  row: DropInRegistration,
): Promise<{ pageId: string; emailSent: boolean; flagged: boolean; error?: string }> {
  const out = { pageId: row.id, emailSent: false, flagged: false } as {
    pageId: string;
    emailSent: boolean;
    flagged: boolean;
    error?: string;
  };

  const parentFirst = (row.parentName || "").split(/\s+/)[0] || "there";
  const childFirst = row.childFirstName || "your player";
  const slug =
    row.sessionTitle && row.sessionDate
      ? sessionToSlug({ title: row.sessionTitle, date: row.sessionDate })
      : "";
  const detailUrl = slug
    ? `${SITE_ORIGIN}/schedule/${slug}`
    : `${SITE_ORIGIN}/schedule`;

  const cancelToken = signCancelToken(row.stripeCheckoutSessionId);
  const cancelUrl = cancelToken
    ? `${SITE_ORIGIN}/schedule/cancel?token=${encodeURIComponent(cancelToken)}`
    : undefined;

  if (
    !resend ||
    !row.parentEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.parentEmail)
  ) {
    out.error = "no_resend_or_email";
    return out;
  }

  // Derive an end time for display: reuse the stored start; the row doesn't
  // carry an end, so fall back to a blank that the template renders gracefully.
  const html = locationRevealHtml({
    parentFirst,
    childFirst,
    sessionTitle: row.sessionTitle,
    sessionDateLong: formatLongDate(row.sessionDate),
    sessionStart: row.sessionStartTime,
    sessionEnd: "",
    sessionLocation: row.location,
    detailUrl,
    cancelUrl,
  });
  const text = locationRevealText({
    parentFirst,
    childFirst,
    sessionTitle: row.sessionTitle,
    sessionDateLong: formatLongDate(row.sessionDate),
    sessionStart: row.sessionStartTime,
    sessionEnd: "",
    sessionLocation: row.location,
    detailUrl,
    cancelUrl,
  });

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: row.parentEmail,
    bcc: ADMIN_EMAIL,
    replyTo: REPLY_TO,
    subject: `Location for tomorrow — ${row.sessionTitle || formatLongDate(row.sessionDate)}`,
    html,
    text,
  });
  if (error) {
    out.error = `resend: ${error.message ?? String(error)}`;
    console.error("[cron/reveal-location] Resend rejected", out.error);
    return out; // leave the flag unset so the next tick retries
  }
  out.emailSent = true;
  out.flagged = await markDropInFlag(row.id, "Location Revealed");
  return out;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // The 24h window spans today + tomorrow (ET), so query both days. Confirmed
  // rows only (fetchUpcomingDropIns already filters Status === Confirmed).
  const fromIso = etPlusDaysIso(0, now);
  const toIso = etPlusDaysIso(1, now);
  const candidates = await fetchUpcomingDropIns(fromIso, toIso, {
    revalidate: 0,
  });

  // Reveal-eligible: hidden, not yet revealed, and within ~24h of start.
  const eligible = candidates.filter(
    (r) =>
      r.locationHidden &&
      !r.locationRevealed &&
      isWithinPreEventWindow(r.sessionDate, r.sessionStartTime, now),
  );

  // Hidden + in-window but the exact venue is still blank: Sam hasn't filled
  // the Location field yet. Skip (don't email a blank address) and surface it
  // loudly so it gets filled before the window closes.
  const missingLocation = eligible.filter((r) => !r.location.trim());
  for (const r of missingLocation) {
    console.warn(
      `[cron/reveal-location] EXACT LOCATION BLANK for in-window hidden session: ${r.id} "${r.sessionTitle}" ${r.sessionDate} ${r.sessionStartTime} — fill the Location field before reveal`,
    );
  }

  const toReveal = eligible.filter((r) => r.location.trim());

  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  if (!resend) {
    console.warn("[cron/reveal-location] RESEND_API_KEY missing — nothing sent");
  }

  const outcomes = [];
  for (const row of toReveal) {
    outcomes.push(await revealOne(resend, row));
  }

  const summary = {
    ok: true,
    window_from_et: fromIso,
    window_to_et: toIso,
    candidates: candidates.length,
    eligible: eligible.length,
    revealed: outcomes.filter((o) => o.emailSent).length,
    errors: outcomes.filter((o) => o.error).length,
    missing_location: missingLocation.map((r) => ({
      id: r.id,
      title: r.sessionTitle,
      date: r.sessionDate,
      start: r.sessionStartTime,
    })),
  };
  console.log("[cron/reveal-location]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
