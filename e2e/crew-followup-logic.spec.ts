import { test, expect } from "@playwright/test";
import {
  daysSince,
  crewFollowupStage,
  NUDGE_AFTER_DAYS,
  REENGAGE_AFTER_DAYS,
  type FollowupRowState,
} from "../src/lib/crew-followup";

const NOW = new Date("2026-06-17T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function row(over: Partial<FollowupRowState>): FollowupRowState {
  return {
    createdTime: daysAgo(0),
    nudgeSent: false,
    reengagementSent: false,
    ...over,
  };
}

test.describe("daysSince", () => {
  test("floors elapsed whole days, never negative", () => {
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(new Date(NOW.getTime() + 86_400_000).toISOString(), NOW)).toBe(0);
    expect(daysSince("garbage", NOW)).toBe(0);
  });
});

test.describe("crewFollowupStage", () => {
  test("fresh rows get nothing", () => {
    expect(crewFollowupStage(row({ createdTime: daysAgo(1) }), NOW)).toBe("none");
    expect(
      crewFollowupStage(row({ createdTime: daysAgo(NUDGE_AFTER_DAYS - 1) }), NOW),
    ).toBe("none");
  });

  test("day 3 → nudge when no nudge sent yet", () => {
    expect(
      crewFollowupStage(row({ createdTime: daysAgo(NUDGE_AFTER_DAYS) }), NOW),
    ).toBe("nudge");
  });

  test("nudge is suppressed once already sent", () => {
    expect(
      crewFollowupStage(
        row({ createdTime: daysAgo(4), nudgeSent: true }),
        NOW,
      ),
    ).toBe("none");
  });

  test("day 7 → reengage even if nudge already went", () => {
    expect(
      crewFollowupStage(
        row({ createdTime: daysAgo(REENGAGE_AFTER_DAYS), nudgeSent: true }),
        NOW,
      ),
    ).toBe("reengage");
  });

  test("reengage wins over nudge when both are due (cron-gap first touch)", () => {
    expect(
      crewFollowupStage(row({ createdTime: daysAgo(10) }), NOW),
    ).toBe("reengage");
  });

  test("reengage is suppressed once already sent", () => {
    expect(
      crewFollowupStage(
        row({ createdTime: daysAgo(20), nudgeSent: true, reengagementSent: true }),
        NOW,
      ),
    ).toBe("none");
  });
});
