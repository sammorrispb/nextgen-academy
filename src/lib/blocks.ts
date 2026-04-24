import type { Block } from "@/data/blocks";

/**
 * Threshold (0..1) at which a block is considered "3/4 done" and the
 * re-register reminder should go out. Slightly below 0.75 so a block that
 * runs M/T/W/Th/M (week 3 Monday) trips the reminder on that Monday.
 */
export const REMINDER_THRESHOLD = 0.7;

/**
 * Returns the fraction of the block elapsed as of `now`. Uses calendar time
 * between startDate and endDate (inclusive of the final session day).
 */
export function blockProgress(block: Block, now: Date = new Date()): number {
  const start = new Date(block.startDate + "T00:00:00").getTime();
  const end = new Date(block.endDate + "T23:59:59").getTime();
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

export function isBlockActive(block: Block, now: Date = new Date()): boolean {
  const progress = blockProgress(block, now);
  return progress > 0 && progress < 1;
}

/**
 * Finds blocks that have crossed the reminder threshold but haven't yet had
 * a "reminder" send logged for the current block id.
 */
export function blocksNeedingReminder(
  blocks: Block[],
  now: Date = new Date(),
): Block[] {
  return blocks.filter((block) => {
    const progress = blockProgress(block, now);
    if (progress < REMINDER_THRESHOLD || progress >= 1) return false;
    const alreadySent = (block.remindersSent ?? []).some((iso) =>
      iso.startsWith(block.id),
    );
    return !alreadySent;
  });
}
