/**
 * Pure gate logic for the /coach/ops console: "Send live" is enabled ONLY
 * after a successful preview (dry run) has run in this page session, against
 * the exact params about to be sent. This turns the terminal-era "always
 * dryRun first" convention into a UI-enforced invariant — the OpsConsole
 * client component derives the button's disabled state from canSendLive(),
 * and e2e/ops-gate.spec.ts pins the behavior without a browser.
 *
 * The state is deliberately minimal (what did the last good preview cover?);
 * transient UI concerns (pending spinners, error text) live in the component.
 */

export interface OpsGateState {
  /** opsParamsKey() snapshot the last successful preview ran against. */
  previewKey: string | null;
  /** Recipient count that preview reported. */
  previewCount: number | null;
}

export const initialOpsGate: OpsGateState = {
  previewKey: null,
  previewCount: null,
};

export type OpsGateEvent =
  | { type: "PREVIEW_OK"; key: string; count: number }
  | { type: "PREVIEW_FAILED" }
  | { type: "PARAMS_CHANGED" }
  | { type: "SENT" }
  | { type: "SEND_FAILED" };

export function opsGateReducer(
  state: OpsGateState,
  event: OpsGateEvent,
): OpsGateState {
  switch (event.type) {
    case "PREVIEW_OK":
      return { previewKey: event.key, previewCount: event.count };
    // Everything else disarms the gate: a failed preview proves nothing, an
    // edited param invalidates what was previewed, and any completed live
    // send (success OR partial failure) requires a fresh preview before the
    // next one — recipients may already have been mailed.
    case "PREVIEW_FAILED":
    case "PARAMS_CHANGED":
    case "SENT":
    case "SEND_FAILED":
      return initialOpsGate;
  }
}

/**
 * True only when a successful preview ran for EXACTLY the params about to be
 * sent, and that preview found at least one recipient.
 */
export function canSendLive(state: OpsGateState, currentKey: string): boolean {
  return (
    state.previewKey !== null &&
    state.previewKey === currentKey &&
    state.previewCount !== null &&
    state.previewCount > 0
  );
}

/** Stable, order-independent serialization of an op's params. */
export function opsParamsKey(params: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(params)
      .sort()
      .map((k) => [k, params[k]]),
  );
}

export function sendLiveLabel(count: number): string {
  return `Send live to ${count} recipient${count === 1 ? "" : "s"}`;
}

/** Confirm-step copy — must state the recipient count from the preview. */
export function confirmSendCopy(opName: string, count: number): string {
  return `This will send the ${opName} email to ${count} recipient${
    count === 1 ? "" : "s"
  } right now. Real email, no undo.`;
}
