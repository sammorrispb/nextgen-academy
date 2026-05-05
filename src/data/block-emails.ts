import type { BallColor } from "./levels";
import type { Block, BlockParticipant } from "./blocks";
import { site } from "./site";

export interface BlockEmailCopy {
  subject: string;
  heading: string;
  progressRecap: string;
  whyContinue: string;
  nextStepHint: string;
}

/**
 * Per-ball-color copy for the end-of-month "next month at NGA" recap email.
 * Sent a few days before the 1st as a heads-up before Stripe auto-renews the
 * monthly subscription. Progress recap is tied to EASE values and what the
 * level actually worked on this month — keep specific, not generic.
 */
export const blockEmailCopy: Record<BallColor, BlockEmailCopy> = {
  red: {
    subject: "Red Ball — your next month at NGA",
    heading: "{childFirstName} has been building real rally habits",
    progressRecap:
      "This month {childFirstName} worked on paddle control, tracking the ball, and the first rallies with a partner. Next month builds on that foundation with consistent contact and court movement.",
    whyContinue:
      "This is the age where showing up every week is the whole game — skills compound fast when kids keep the rhythm.",
    nextStepHint:
      "Same day and time next month. Coaches will nudge you on readiness for Orange Ball if {childFirstName} is tracking ahead.",
  },
  orange: {
    subject: "Orange Ball — your next month at NGA",
    heading: "{childFirstName} is starting to compete, not just rally",
    progressRecap:
      "This month focused on rules mastery, sustained rallies, and full-court movement. You've seen {childFirstName} start to think about where the ball is going, not just where it is.",
    whyContinue:
      "The jump from rallying to real points happens over the next four weeks. Missing a month here is the single biggest reason players stall.",
    nextStepHint:
      "Same day and time next month. If {childFirstName} is ready for Green Ball, we'll flag it after the next evaluation window.",
  },
  green: {
    subject: "Green Ball — your next month at NGA",
    heading: "{childFirstName} is making real tactical decisions",
    progressRecap:
      "Shot selection, court positioning, and doubles teamwork were the focus this month. {childFirstName} is starting to own the kitchen line and play points on purpose.",
    whyContinue:
      "Green is where strategy sticks. Next month adds pressure situations and partner communication — that's what carries into tournament play.",
    nextStepHint:
      "Same day and time next month. Ask us about Yellow Ball evaluation if {childFirstName} wants the competitive track.",
  },
  yellow: {
    subject: "Yellow Ball — your next month at NGA",
    heading: "{childFirstName}'s next month of competitive prep",
    progressRecap:
      "Small-group, coach-curated work on match play, shot patterns, and tournament readiness. You know the drill — {childFirstName} is here because they want the next level.",
    whyContinue:
      "Continuity matters most at this level. We build real progression month over month, not one-off sessions.",
    nextStepHint:
      "Reply to this email if you want to coordinate scheduling around tournaments or school next month.",
  },
};

function renderCopy(copy: string, participant: BlockParticipant): string {
  return copy.replaceAll("{childFirstName}", participant.childFirstName);
}

function formatDateLong(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Renders the full HTML email body for a single participant. Subject is
 * returned separately so the caller can pass it to Resend.
 */
export function renderBlockReminderEmail(
  block: Block,
  participant: BlockParticipant,
): { subject: string; html: string } {
  const copy = blockEmailCopy[block.level];
  const subject = copy.subject;
  const heading = renderCopy(copy.heading, participant);
  const progressRecap = renderCopy(copy.progressRecap, participant);
  const nextStepHint = renderCopy(copy.nextStepHint, participant);
  const nextStart = formatDateLong(block.nextBlockStartDate);

  const html = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 8px;">
    ${heading}
  </h1>
  <p style="font-size: 15px; line-height: 1.6;">Hi ${participant.parentName},</p>
  <p style="font-size: 15px; line-height: 1.6;">${progressRecap}</p>
  <p style="font-size: 15px; line-height: 1.6;">${copy.whyContinue}</p>

  <div style="background: #0C1F47; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">Next month</p>
    <p style="margin: 0 0 4px; font-size: 16px; line-height: 1.5; color: #EEF2FF;">
      <strong>${block.label}</strong>
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #AAB4D4;">
      Starts ${nextStart} · ${block.nextBlockSessionCount} sessions × $35 · $${block.nextBlockPriceUsd} on the 1st
    </p>
    <a href="${block.reregisterUrl}"
       style="display: inline-block; background: #AADC00; color: #05132B; font-weight: 700; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 15px;">
      Manage ${participant.childFirstName}'s subscription
    </a>
  </div>

  <p style="font-size: 14px; line-height: 1.6; color: #AAB4D4;">${nextStepHint}</p>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1A3060;">
    <p style="font-size: 14px; line-height: 1.6;">
      Questions? Reply to this email or text Sam at
      <a href="tel:${site.phone}" style="color: #00D4FF;">${site.phone}</a>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin-top: 16px;">
      See you on the court!<br/>
      <strong style="color: #AADC00;">— Coach Sam &amp; Coach Amine</strong><br/>
      <span style="color: #7A88B8;">Next Gen Pickleball Academy</span><br/>
      <a href="https://nextgenpbacademy.com" style="color: #00D4FF;">nextgenpbacademy.com</a>
    </p>
  </div>
</div>`;

  return { subject, html };
}
