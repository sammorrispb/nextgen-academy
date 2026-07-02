import { test, expect } from "@playwright/test";
import {
  initialOpsGate,
  opsGateReducer,
  canSendLive,
  opsParamsKey,
  parseOnlyList,
  sendLiveLabel,
  confirmSendCopy,
  type OpsGateState,
} from "../src/lib/ops-gate";

// The /coach/ops page turns the "dryRun first" curl convention into a
// UI-ENFORCED gate: "Send live" is disabled until a preview (dry run) has
// succeeded in this page session, against the exact params being sent. The
// gate logic lives in the pure reducer src/lib/ops-gate.ts (OpsConsole.tsx
// derives the button's disabled state from canSendLive), so the invariant is
// pinned here without a browser. Mutation check: make canSendLive return true
// unconditionally → the "no preview yet" cases below fail.

const KEY = opsParamsKey({ includeAmbiguous: false });
const OTHER_KEY = opsParamsKey({ includeAmbiguous: true });

function apply(events: Parameters<typeof opsGateReducer>[1][]): OpsGateState {
  return events.reduce(opsGateReducer, initialOpsGate);
}

test.describe("ops gate — dryRun-first is enforced, not convention", () => {
  test("initial state: Send live is disabled (no preview has run)", () => {
    expect(canSendLive(initialOpsGate, KEY)).toBe(false);
  });

  test("a successful preview with recipients arms Send live for those params", () => {
    const s = apply([{ type: "PREVIEW_OK", key: KEY, count: 2 }]);
    expect(canSendLive(s, KEY)).toBe(true);
  });

  test("preview armed for params A does NOT arm Send live for params B", () => {
    const s = apply([{ type: "PREVIEW_OK", key: KEY, count: 2 }]);
    expect(canSendLive(s, OTHER_KEY)).toBe(false);
  });

  test("editing params after a preview invalidates it (must re-preview)", () => {
    const s = apply([
      { type: "PREVIEW_OK", key: KEY, count: 2 },
      { type: "PARAMS_CHANGED" },
    ]);
    expect(canSendLive(s, KEY)).toBe(false);
  });

  test("a preview with zero recipients never arms Send live", () => {
    const s = apply([{ type: "PREVIEW_OK", key: KEY, count: 0 }]);
    expect(canSendLive(s, KEY)).toBe(false);
  });

  test("a failed preview never arms Send live", () => {
    const s = apply([{ type: "PREVIEW_FAILED" }]);
    expect(canSendLive(s, KEY)).toBe(false);
  });

  test("after a live send, the gate resets — re-preview before sending again", () => {
    const s = apply([
      { type: "PREVIEW_OK", key: KEY, count: 2 },
      { type: "SENT" },
    ]);
    expect(canSendLive(s, KEY)).toBe(false);
  });

  test("after a FAILED live send, the gate resets (recipients may be partially mailed)", () => {
    const s = apply([
      { type: "PREVIEW_OK", key: KEY, count: 2 },
      { type: "SEND_FAILED" },
    ]);
    expect(canSendLive(s, KEY)).toBe(false);
  });

  test("the gate re-arms after a FRESH preview following a send", () => {
    const s = apply([
      { type: "PREVIEW_OK", key: KEY, count: 2 },
      { type: "SENT" },
      { type: "PREVIEW_OK", key: KEY, count: 1 },
    ]);
    expect(canSendLive(s, KEY)).toBe(true);
  });
});

test.describe("opsParamsKey — the preview is bound to the exact params", () => {
  test("stable across property insertion order", () => {
    expect(opsParamsKey({ a: 1, b: "x" })).toBe(opsParamsKey({ b: "x", a: 1 }));
  });

  test("different values produce different keys", () => {
    expect(opsParamsKey({ includeAmbiguous: false })).not.toBe(
      opsParamsKey({ includeAmbiguous: true }),
    );
    expect(opsParamsKey({ playerId: "p1" })).not.toBe(
      opsParamsKey({ playerId: "p2" }),
    );
  });
});

test.describe("parseOnlyList — the camp allow-list textarea parser", () => {
  test("splits on newlines, commas, and semicolons; trims; drops empties", () => {
    expect(parseOnlyList("a@x.org\n b@x.org ,c@x.org; \n\n")).toEqual([
      "a@x.org",
      "b@x.org",
      "c@x.org",
    ]);
  });

  test("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseOnlyList("A@x.org\na@X.ORG\nb@x.org")).toEqual([
      "A@x.org",
      "b@x.org",
    ]);
  });

  test("empty/whitespace input parses to an empty list (live send stays blocked)", () => {
    expect(parseOnlyList("")).toEqual([]);
    expect(parseOnlyList("  \n , ;  ")).toEqual([]);
  });

  test("a different pasted list produces a different params key (fresh preview required)", () => {
    expect(opsParamsKey({ only: parseOnlyList("a@x.org") })).not.toBe(
      opsParamsKey({ only: parseOnlyList("a@x.org\nb@x.org") }),
    );
  });
});

test.describe("send-live copy — the confirm step states the previewed count", () => {
  test("sendLiveLabel carries the recipient count", () => {
    expect(sendLiveLabel(2)).toContain("2");
    expect(sendLiveLabel(1)).toContain("1");
  });

  test("confirmSendCopy states the count and singular/plural correctly", () => {
    const two = confirmSendCopy("camp outreach", 2);
    expect(two).toContain("2");
    expect(two).toContain("recipients");
    expect(two).toContain("camp outreach");
    const one = confirmSendCopy("post-eval follow-up", 1);
    expect(one).toContain("1");
    expect(one).toContain("recipient");
    expect(one).not.toContain("recipients");
  });
});
