import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Structural parity pin. The agent route's fan-out is only equal to the coach
// UI action's fan-out for as long as BOTH delegate to the same markAttendanceCore.
// The route's behavior is covered by mark-attendance.spec.ts; this guards the
// OTHER side — that markAttendanceAction never regrows an inline, divergent
// fan-out. If someone re-inlines setDropInAttendance / ingestToOpenBrain /
// recomputePlayerAttendance into the action, this turns red.
const actionSrc = readFileSync(
  join(__dirname, "..", "src", "app", "coach", "(authed)", "[slug]", "actions.ts"),
  "utf8",
);

test.describe("attendance parity — action delegates to the shared core", () => {
  test("markAttendanceAction calls markAttendanceCore exactly once", () => {
    const calls = actionSrc.match(/markAttendanceCore\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  test("markAttendanceAction contains no inline fan-out triggers", () => {
    // The fan-out must live in the shared lib, not be re-inlined in the action.
    expect(actionSrc).not.toContain("setDropInAttendance(");
    expect(actionSrc).not.toContain("ingestToOpenBrain(");
    expect(actionSrc).not.toContain("recomputePlayerAttendance(");
  });
});
