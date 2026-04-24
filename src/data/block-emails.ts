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
 * Per-ball-color copy for the "3/4 through the block" re-registration email.
 * Progress recap is tied to the EASE values and what the level is actually
 * working on — keep these specific, not generic.
 */
export const blockEmailCopy: Record<BallColor, BlockEmailCopy> = {
  red: {
    subject: "Red Ball — next 4-week block opens soon",
    heading: "{childFirstName} has been building real rally habits",
    progressRecap:
      "Over the last three weeks {childFirstName} has worked on paddle control, tracking the ball, and the first rallies with a partner. The next block builds on that foundation with consistent contact and court movement.",
    whyContinue:
      "This is the age where showing up every week is the whole game — skills compound fast when kids keep the rhythm.",
    nextStepHint:
      "Same day and time next block, and coaches will nudge you on readiness for Orange Ball if {childFirstName} is tracking ahead.",
  },
  orange: {
    subject: "Orange Ball — next 4-week block opens soon",
    heading: "{childFirstName} is starting to compete, not just rally",
    progressRecap:
      "This block focused on rules mastery, sustained rallies, and full-court movement. You've seen {childFirstName} start to think about where the ball is going, not just where it is.",
    whyContinue:
      "The jump from rallying to real points happens in the next 4 weeks. Missing a block here is the single biggest reason players stall.",
    nextStepHint:
      "Same day and time next block. If {childFirstName} is ready for Green Ball, we'll flag it after the final session.",
  },
  green: {
    subject: "Green Ball — next 4-week block opens soon",
    heading: "{childFirstName} is making real tactical decisions",
    progressRecap:
      "Shot selection, court positioning, and doubles teamwork were the focus this block. {childFirstName} is starting to own the kitchen line and play points on purpose.",
    whyContinue:
      "Green is where strategy sticks. The next block adds pressure situations and partner communication — that's what carries into tournament play.",
    nextStepHint:
      "Same day and time next block. Ask us about Yellow Ball evaluation if {childFirstName} wants the competitive track.",
  },
  yellow: {
    subject: "Yellow Ball — next block & scheduling",
    heading: "{childFirstName}'s next 4 weeks of competitive prep",
    progressRecap:
      "Small-group, coach-curated work on match play, shot patterns, and tournament readiness. You know the drill — {childFirstName} is here because they want the next level.",
    whyContinue:
      "Yellow Ball runs on 4-week commitments so we can build real progression, not one-off sessions. Continuity matters most at this level.",
    nextStepHint:
      "Reply to this email to lock in scheduling for the next block — we'll coordinate around tournaments and school.",
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
    <p style="margin: 0 0 4px; font-size: 13px; color: #7A88B8; text-transform: uppercase; letter-spacing: 1px;">Next block</p>
    <p style="margin: 0 0 4px; font-size: 16px; line-height: 1.5; color: #EEF2FF;">
      <strong>${block.label}</strong>
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #AAB4D4;">
      Starts ${nextStart} · 4 sessions · $${block.nextBlockPriceUsd}
    </p>
    <a href="${block.reregisterUrl}"
       style="display: inline-block; background: #AADC00; color: #05132B; font-weight: 700; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 15px;">
      Re-register ${participant.childFirstName}
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
