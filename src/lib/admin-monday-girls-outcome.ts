/**
 * Turn an /api/admin/monday-girls/* response into what the operator reads.
 * Pure so every branch is testable without rendering: a failure must show the
 * route's own words in red, and "the parent email didn't go out" must never
 * hide behind a green check.
 */
export interface OutcomeView {
  tone: "ok" | "warn" | "error";
  text: string;
}

export function describeRemoveOutcome(
  httpOk: boolean,
  json: {
    ok?: boolean;
    status?: string;
    refundedUsd?: number;
    emailSent?: boolean;
    error?: string;
  } | null,
  notifyParent: boolean,
): OutcomeView {
  if (!httpOk || !json?.ok) {
    return { tone: "error", text: json?.error || "Something went wrong — nothing was confirmed." };
  }
  const what =
    json.status === "Refunded"
      ? `Marked Refunded ($${(json.refundedUsd ?? 0).toFixed(2)} back per Stripe).`
      : "Marked Cancelled — seat freed.";
  if (notifyParent && !json.emailSent) {
    return { tone: "warn", text: `${what} The parent email did NOT send — reach out yourself.` };
  }
  return { tone: "ok", text: notifyParent ? `${what} Parent emailed.` : what };
}
