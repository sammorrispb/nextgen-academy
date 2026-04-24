import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { blocks } from "@/data/blocks";
import { blocksNeedingReminder, blockProgress } from "@/lib/blocks";
import { renderBlockReminderEmail } from "@/data/block-emails";
import { site } from "@/data/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const ADMIN_EMAIL = "sam.morris2131@gmail.com";

/**
 * Vercel Cron hits this at the schedule in vercel.json. Each run:
 *   1. finds blocks that crossed the 3/4 threshold and haven't been notified
 *   2. emails each participant with the per-group re-register copy
 *   3. emails Sam a summary so he knows what went out
 *
 * Dedup: remindersSent[] on the Block is source-of-truth. The cron reports
 * what it sent; Sam commits the updated block data to mark it done. This
 * keeps the audit trail in git instead of an ephemeral store.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );
  }

  const now = new Date();
  const due = blocksNeedingReminder(blocks, now);

  if (due.length === 0) {
    return NextResponse.json({
      ranAt: now.toISOString(),
      blocksChecked: blocks.length,
      blocksDue: 0,
      sent: [],
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const sent: Array<{
    blockId: string;
    participant: string;
    email: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const block of due) {
    for (const participant of block.participants) {
      if (!participant.email) {
        sent.push({
          blockId: block.id,
          participant: participant.childFirstName,
          email: "(no email)",
          ok: false,
          error: "no email on file",
        });
        continue;
      }

      const { subject, html } = renderBlockReminderEmail(block, participant);
      try {
        const result = await resend.emails.send({
          from: FROM_EMAIL,
          to: participant.email,
          replyTo: site.email,
          subject,
          html,
        });
        sent.push({
          blockId: block.id,
          participant: participant.childFirstName,
          email: participant.email,
          ok: !result.error,
          error: result.error?.message,
        });
      } catch (err) {
        sent.push({
          blockId: block.id,
          participant: participant.childFirstName,
          email: participant.email,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const summaryLines = due.map((block) => {
    const rows = sent
      .filter((s) => s.blockId === block.id)
      .map(
        (s) =>
          `  - ${s.participant} <${s.email}> — ${s.ok ? "sent" : `FAILED: ${s.error}`}`,
      )
      .join("\n");
    const progressPct = Math.round(blockProgress(block, now) * 100);
    return `${block.label} (${progressPct}% complete)\n${rows || "  (no participants on record)"}`;
  });

  const summaryText = [
    `Block re-register reminders — ${now.toISOString()}`,
    "",
    ...summaryLines,
    "",
    "To mark these blocks as notified, add the run timestamp to the block's",
    "remindersSent[] in src/data/blocks.ts and commit.",
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Block reminders sent — ${due.length} block(s)`,
      text: summaryText,
    });
  } catch (err) {
    console.error("Admin summary send failed:", err);
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    blocksChecked: blocks.length,
    blocksDue: due.length,
    sent,
  });
}
