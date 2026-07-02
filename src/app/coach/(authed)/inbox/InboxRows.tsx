"use client";

import { useState, useTransition } from "react";
import {
  triageNewsAction,
  decideDraftAction,
  reviewCrewInterestAction,
  reactivateCommitAction,
  type InboxActionResult,
} from "./actions";

// Client shells for the four queues' one-tap actions. All gates are
// server-side in actions.ts — these components only provide pending states,
// the CardFailed confirm step, and optimistic row dismissal (revalidatePath
// re-renders the server lists right after, so the local state is cosmetic).

const BTN_BASE =
  "inline-flex items-center justify-center px-4 rounded-full text-sm font-bold transition-colors min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_GO = `${BTN_BASE} bg-ngpa-teal/15 border border-ngpa-teal/50 text-ngpa-teal hover:bg-ngpa-teal/25`;
const BTN_QUIET = `${BTN_BASE} border border-ngpa-slate/60 text-ngpa-white/75 hover:border-ngpa-teal hover:text-ngpa-teal`;
const BTN_WARN = `${BTN_BASE} bg-amber-400/15 border border-amber-400/50 text-amber-300 hover:bg-amber-400/25`;

function ResultLine({ result }: { result: InboxActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`text-sm font-bold ${result.ok ? "text-emerald-300" : "text-red-400"}`}
    >
      {result.ok ? "✓ " : ""}
      {result.message}
    </p>
  );
}

function useRowAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<InboxActionResult | null>(null);
  const run = (fn: () => Promise<InboxActionResult>) =>
    startTransition(async () => {
      setResult(await fn());
    });
  return { pending, result, setResult, run };
}

/**
 * The shared two-tap decision row (F9): one primary "go" action, one quiet
 * secondary — news triage and crew review are the same interaction with
 * different labels/actions, so they render through this single component.
 */
function TwoDecisionRow({
  goLabel,
  quietLabel,
  onGo,
  onQuiet,
}: {
  goLabel: string;
  quietLabel: string;
  onGo: () => Promise<InboxActionResult>;
  onQuiet: () => Promise<InboxActionResult>;
}) {
  const { pending, result, run } = useRowAction();
  if (result?.ok) return <ResultLine result={result} />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(onGo)}
        className={BTN_GO}
      >
        {goLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(onQuiet)}
        className={BTN_QUIET}
      >
        {quietLabel}
      </button>
      <ResultLine result={result} />
    </div>
  );
}

export function NewsRowActions({ pageId }: { pageId: string }) {
  return (
    <TwoDecisionRow
      goLabel="Approve"
      quietLabel="Reject"
      onGo={() => triageNewsAction(pageId, "approve")}
      onQuiet={() => triageNewsAction(pageId, "reject")}
    />
  );
}

export function DraftCard({
  pageId,
  weekTitle,
  draftedAt,
  withinShipWindow,
  bodyHtml,
  bodyUnavailable,
}: {
  pageId: string;
  weekTitle: string;
  draftedAt: string;
  withinShipWindow: boolean;
  bodyHtml: string;
  bodyUnavailable: boolean;
}) {
  const { pending, result, setResult, run } = useRowAction();
  return (
    <div className="bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-black text-ngpa-white tracking-tight">
            {weekTitle || "Newsletter draft"}
          </p>
          <p className="text-xs text-ngpa-white/60 mt-0.5">
            Drafted {draftedAt || "(no date)"} ·{" "}
            {withinShipWindow ? (
              <span className="text-ngpa-teal font-bold">
                rides Thursday&rsquo;s send if approved
              </span>
            ) : (
              <span className="text-amber-300 font-bold">
                misses Thursday&rsquo;s send — the cron&rsquo;s freshness
                filter will exclude it
              </span>
            )}
          </p>
        </div>
      </div>

      {bodyUnavailable ? (
        /* F3 — the row's body couldn't be fetched. Surface the row (a Notion
           blip must never hide a pending decision) but keep Approve disabled:
           approval is approval of READ content. setDraftStatus re-reads the
           body server-side too, so this is UX, not the gate. */
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-4 mb-4 text-sm text-amber-200 leading-relaxed">
          The draft body couldn&rsquo;t load from Notion just now — reload to
          retry, or review it directly in Notion. Approving is disabled until
          the body is readable.
        </div>
      ) : (
        /* The rendered body — the exact HTML the Thursday cron would ship
           (same blocksToHtml renderer, same scheme-allowlisted links). The
           Approve button lives INSIDE this card only: approving means you
           read this. */
        <div
          className="rounded-xl bg-white text-black px-4 py-4 mb-4 overflow-x-auto text-sm"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}

      {result?.ok ? (
        <ResultLine result={result} />
      ) : result?.needsForce ? (
        /* F4 — the server refused: this approval won't ride Thursday's send.
           One explicit tap approves anyway; Never mind returns to the card. */
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 space-y-3">
          <p className="text-sm text-amber-200 leading-relaxed">{result.message}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => decideDraftAction(pageId, "approve", { force: true }))
              }
              className={BTN_WARN}
            >
              Approve anyway — won&rsquo;t ship Thursday
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setResult(null)}
              className={BTN_QUIET}
            >
              Never mind
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || bodyUnavailable}
            onClick={() => run(() => decideDraftAction(pageId, "approve"))}
            className={BTN_GO}
          >
            Approve for Thursday
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => decideDraftAction(pageId, "skip"))}
            className={BTN_QUIET}
          >
            Skip — don&rsquo;t ship
          </button>
          <ResultLine result={result} />
        </div>
      )}
    </div>
  );
}

export function CrewRowActions({ pageId }: { pageId: string }) {
  return (
    <TwoDecisionRow
      goLabel="Mark reviewed"
      quietLabel="Close"
      onGo={() => reviewCrewInterestAction(pageId, "reviewed")}
      onQuiet={() => reviewCrewInterestAction(pageId, "closed")}
    />
  );
}

export function CommitReactivate({
  pageId,
  childFirstName,
}: {
  pageId: string;
  childFirstName: string;
}) {
  const { pending, result, run } = useRowAction();
  const [armed, setArmed] = useState(false);

  if (result?.ok) return <ResultLine result={result} />;

  if (!armed) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setArmed(true)}
          className={BTN_WARN}
        >
          Re-activate…
        </button>
        <ResultLine result={result} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 space-y-3">
      <p className="text-sm text-amber-200 leading-relaxed">
        Re-activating this commit means the parent&rsquo;s{" "}
        <strong>stored card will be charged</strong> for{" "}
        {childFirstName || "this child"}&rsquo;s next session on the next
        daily autoreserve run — make sure the card issue is actually resolved
        with the parent first.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => reactivateCommitAction(pageId, { confirmed: true }))
          }
          className={BTN_WARN}
        >
          Confirm — charge on next run
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setArmed(false)}
          className={BTN_QUIET}
        >
          Cancel
        </button>
        <ResultLine result={result} />
      </div>
    </div>
  );
}
