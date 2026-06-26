import { test, expect } from "@playwright/test";
import {
  partitionByCancelledSession,
  type SuppressionDropIn,
  type SuppressionSession,
} from "../src/lib/reminder-suppression";

// Invariant: the 24h drop-in reminder cron must NEVER mail "your player is on
// the court tomorrow" for a session that has been cancelled. A Confirmed
// drop-in can still point at a Cancelled session — cancelling flips only the
// session row (setSessionStatus), while the per-drop-in rows go Refunded later
// (async charge.refunded webhook) or never (hand-cancelled-in-Notion weather
// pull). This pins the pure cross-reference that holds those rows back.
// Regression guard for IMG_6581/IMG_6582 (Sat Jun 27 Sherwood HS).

const dropIn = (over: Partial<SuppressionDropIn>): SuppressionDropIn => ({
  sessionRowId: "",
  sessionTitle: "Sherwood HS — Green",
  sessionStartTime: "10:00 AM",
  ...over,
});

const session = (over: Partial<SuppressionSession>): SuppressionSession => ({
  id: "sess-1",
  title: "Sherwood HS — Green",
  startTime: "10:00 AM",
  status: "Open",
  ...over,
});

test.describe("partitionByCancelledSession", () => {
  test("suppresses a drop-in matched by Session Row ID to a Cancelled session", () => {
    const rows = [dropIn({ sessionRowId: "sess-1" })];
    const { send, suppressed } = partitionByCancelledSession(rows, [
      session({ id: "sess-1", status: "Cancelled" }),
    ]);
    expect(send).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
  });

  test("suppresses a legacy drop-in (no Session Row ID) by title + start time", () => {
    const rows = [dropIn({ sessionRowId: "" })];
    const { send, suppressed } = partitionByCancelledSession(rows, [
      session({ id: "sess-1", status: "Cancelled" }),
    ]);
    expect(send).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
  });

  test("sends when the session is Open or Full", () => {
    const rows = [dropIn({ sessionRowId: "sess-1" })];
    for (const status of ["Open", "Full"]) {
      const { send, suppressed } = partitionByCancelledSession(rows, [
        session({ id: "sess-1", status }),
      ]);
      expect(send, status).toHaveLength(1);
      expect(suppressed, status).toHaveLength(0);
    }
  });

  test("does NOT cross-suppress a per-level sibling sharing the start time", () => {
    // Red court cancelled, Yellow court still on — same date + start time, but
    // distinct titles. Yellow's reminder must still go out.
    const rows = [
      dropIn({ sessionRowId: "yellow", sessionTitle: "Redland Tuesday — Yellow" }),
    ];
    const { send, suppressed } = partitionByCancelledSession(rows, [
      session({ id: "red", title: "Redland Tuesday — Red", status: "Cancelled" }),
      session({ id: "yellow", title: "Redland Tuesday — Yellow", status: "Open" }),
    ]);
    expect(send).toHaveLength(1);
    expect(suppressed).toHaveLength(0);
  });

  test("matches title/time case- and whitespace-insensitively", () => {
    const rows = [
      dropIn({
        sessionRowId: "",
        sessionTitle: "  Sherwood HS — Green  ",
        sessionStartTime: "10:00 am",
      }),
    ];
    const { send, suppressed } = partitionByCancelledSession(rows, [
      session({ status: "Cancelled" }),
    ]);
    expect(send).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
  });

  test("no session rows → everything sends (Notion-blip safe)", () => {
    const rows = [dropIn({ sessionRowId: "sess-1" }), dropIn({ sessionRowId: "sess-2" })];
    const { send, suppressed } = partitionByCancelledSession(rows, []);
    expect(send).toHaveLength(2);
    expect(suppressed).toHaveLength(0);
  });
});
