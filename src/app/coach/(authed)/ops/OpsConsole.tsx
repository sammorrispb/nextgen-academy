"use client";

import { useReducer, useState, useTransition } from "react";
import {
  initialOpsGate,
  opsGateReducer,
  canSendLive,
  opsParamsKey,
  sendLiveLabel,
  confirmSendCopy,
} from "@/lib/ops-gate";
import {
  evalReengagementAction,
  campOutreachAction,
  postEvalFollowupAction,
  type OpsActionResult,
} from "./actions";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-ngpa-deep border border-ngpa-slate/60 text-ngpa-white text-sm placeholder:text-ngpa-white/30 focus:outline-none focus:border-ngpa-teal";
const labelClass = "block text-xs font-bold text-ngpa-white/80 mb-1.5";
const primaryBtn =
  "px-4 py-2 rounded-full bg-ngpa-teal/15 border border-ngpa-teal/50 text-ngpa-teal hover:bg-ngpa-teal/25 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]";
const dangerBtn =
  "px-4 py-2 rounded-full bg-ngpa-red/15 border border-ngpa-red/60 text-ngpa-red hover:bg-ngpa-red/25 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]";
const ghostBtn =
  "px-4 py-2 rounded-full border border-ngpa-slate/60 hover:border-ngpa-teal hover:text-ngpa-teal text-sm font-bold transition-colors min-h-[40px]";

interface PreviewRecipient {
  name: string;
  email: string;
}

/**
 * One ops card. The dryRun-first gate is the pure reducer in
 * src/lib/ops-gate.ts (pinned by e2e/ops-gate.spec.ts): "Send live" stays
 * disabled until a preview succeeded in THIS page session against EXACTLY the
 * params about to be sent, and the confirm step states the previewed count.
 */
function OpsCard({
  title,
  description,
  opName,
  params,
  paramsUi,
  countFromPreview,
  run,
  renderPreview,
}: {
  title: string;
  description: string;
  opName: string;
  params: Record<string, unknown>;
  paramsUi?: React.ReactNode;
  countFromPreview: (body: Record<string, unknown>) => number;
  run: (dryRun: boolean) => Promise<OpsActionResult>;
  renderPreview: (body: Record<string, unknown>) => React.ReactNode;
}) {
  const [gate, dispatch] = useReducer(opsGateReducer, initialOpsGate);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentSummary, setSentSummary] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const key = opsParamsKey(params);
  const armed = canSendLive(gate, key);

  function doPreview() {
    startTransition(async () => {
      setError(null);
      setSentSummary(null);
      setConfirming(false);
      const r = await run(true);
      if (!r.ok || !r.body) {
        dispatch({ type: "PREVIEW_FAILED" });
        setPreview(null);
        setError(
          r.message ?? String(r.body?.error ?? `Preview failed (${r.status})`),
        );
        return;
      }
      setPreview(r.body);
      dispatch({ type: "PREVIEW_OK", key, count: countFromPreview(r.body) });
    });
  }

  function doSendLive() {
    // Belt over the reducer's suspenders — never fire without an armed gate.
    if (!canSendLive(gate, key)) return;
    startTransition(async () => {
      setError(null);
      setConfirming(false);
      const r = await run(false);
      if (!r.ok || !r.body) {
        dispatch({ type: "SEND_FAILED" });
        setError(
          r.message ?? String(r.body?.error ?? `Send failed (${r.status})`),
        );
        return;
      }
      dispatch({ type: "SENT" });
      setPreview(null);
      const b = r.body;
      setSentSummary(
        typeof b.sent === "number"
          ? `Sent ${b.sent}, failed ${b.failed ?? 0}.`
          : `Sent to ${String(b.sent_to ?? "recipient")}.`,
      );
    });
  }

  return (
    <section className="rounded-2xl border border-ngpa-slate/40 bg-ngpa-panel/60 p-5 sm:p-6">
      <h2 className="font-heading text-xl font-black text-ngpa-white tracking-tight mb-1">
        {title}
      </h2>
      <p className="text-sm text-ngpa-white/65 leading-relaxed mb-4">
        {description}
      </p>

      {paramsUi ? (
        <div
          className="mb-4"
          onChange={() => {
            dispatch({ type: "PARAMS_CHANGED" });
            setPreview(null);
            setConfirming(false);
          }}
        >
          {paramsUi}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primaryBtn}
          onClick={doPreview}
          disabled={pending}
        >
          {pending ? "Working…" : "Preview (dry run)"}
        </button>
        <button
          type="button"
          className={dangerBtn}
          onClick={() => setConfirming(true)}
          disabled={!armed || pending || confirming}
          title={
            armed
              ? undefined
              : "Run a preview first — Send live unlocks after a dry run of these exact settings."
          }
        >
          {armed && gate.previewCount !== null
            ? sendLiveLabel(gate.previewCount)
            : "Send live (preview first)"}
        </button>
      </div>

      {confirming && armed && gate.previewCount !== null && (
        <div className="mt-4 rounded-xl border border-ngpa-red/50 bg-ngpa-red/10 p-4">
          <p className="text-sm font-bold text-ngpa-white mb-3">
            {confirmSendCopy(opName, gate.previewCount)}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={dangerBtn}
              onClick={doSendLive}
              disabled={pending}
            >
              {pending ? "Sending…" : "Confirm send"}
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm font-bold text-ngpa-red">{error}</p>
      )}

      {sentSummary && (
        <div className="mt-4 rounded-xl border border-ngpa-skill-green/50 bg-ngpa-skill-green/10 p-4">
          <p className="text-sm font-bold text-ngpa-skill-green">
            {sentSummary} Run a fresh preview before sending again.
          </p>
        </div>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-ngpa-slate/40 bg-ngpa-deep/60 p-4 text-sm text-ngpa-white/80">
          {renderPreview(preview)}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-ngpa-panel/80 border border-ngpa-slate/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-ngpa-white/50 font-bold">
        {label}
      </p>
      <p className="text-lg font-black text-ngpa-white">{String(value ?? "—")}</p>
    </div>
  );
}

function RecipientList({ body }: { body: Record<string, unknown> }) {
  const recipients = (body.recipients ?? []) as PreviewRecipient[];
  if (!recipients.length) {
    return (
      <p className="text-ngpa-white/60">
        No recipients match — nothing would be sent.
      </p>
    );
  }
  return (
    <ul className="max-h-56 overflow-y-auto divide-y divide-ngpa-slate/20">
      {recipients.map((r) => (
        <li key={r.email} className="py-1.5 flex flex-wrap gap-x-2">
          <span className="font-bold text-ngpa-white">{r.name || "—"}</span>
          <span className="text-ngpa-white/60">{r.email}</span>
        </li>
      ))}
    </ul>
  );
}

function BlastPreview({
  body,
  extraStats,
}: {
  body: Record<string, unknown>;
  extraStats?: Array<{ label: string; value: unknown }>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Stat label="Would send" value={body.to_send} />
        <Stat label="Eligible rows" value={body.eligible_rows} />
        <Stat label="Off-limits (excluded)" value={body.off_limits} />
        <Stat label="Ambiguous" value={body.ambiguous ?? body.ambiguous_rows} />
        {(extraStats ?? []).map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
      <p className="mb-2 text-xs text-ngpa-white/50">
        Subject: <span className="text-ngpa-white/80">{String(body.subject)}</span>
      </p>
      <RecipientList body={body} />
    </>
  );
}

export default function OpsConsole() {
  const [includeAmbiguous, setIncludeAmbiguous] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [level, setLevel] = useState("Green");
  const [observations, setObservations] = useState("");

  return (
    <div className="grid grid-cols-1 gap-6 max-w-3xl">
      <OpsCard
        title="Eval re-engagement"
        description="Invites every DD-clean eligible lead who never converted to join the free newsletter. Off-limits (DD-derived or opted-out) rows are excluded automatically; ambiguous rows are always held."
        opName="eval re-engagement"
        params={{}}
        countFromPreview={(b) => Number(b.to_send ?? 0)}
        run={(dryRun) => evalReengagementAction({ dryRun })}
        renderPreview={(b) => <BlastPreview body={b} />}
      />

      <OpsCard
        title="Camp outreach"
        description="Mails the summer-camp invite to the eligible warm list. Default is eligible-only; the toggle adds the ambiguous bucket (own leads with an unverified source — never DD-derived)."
        opName="camp outreach"
        params={{ includeAmbiguous }}
        paramsUi={
          <label className="flex items-start gap-2.5 text-sm text-ngpa-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAmbiguous}
              onChange={(e) => setIncludeAmbiguous(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-ngpa-teal"
            />
            <span>
              Also mail the <strong>ambiguous</strong> bucket (unverified own
              leads — changing this requires a fresh preview)
            </span>
          </label>
        }
        countFromPreview={(b) => Number(b.to_send ?? 0)}
        run={(dryRun) => campOutreachAction({ dryRun, includeAmbiguous })}
        renderPreview={(b) => (
          <BlastPreview
            body={b}
            extraStats={[
              {
                label: "Ambiguous mailed",
                value: b.ambiguous_mailed ? "yes" : "no",
              },
            ]}
          />
        )}
      />

      <OpsCard
        title="Post-eval follow-up"
        description="Sends one parent the next-steps email for their child's evaluation (level card + live session list) and stamps Level, Status and Next Action on the CRM row. Player ID is the Notion page ID from the family profile."
        opName="post-eval follow-up"
        params={{ playerId, level, observations }}
        paramsUi={
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Player ID (Notion page) *</label>
              <input
                className={inputClass}
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="21281d02-…"
              />
            </div>
            <div>
              <label className={labelClass}>Level *</label>
              <select
                className={inputClass}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="Red">Red</option>
                <option value="Orange">Orange</option>
                <option value="Green">Green</option>
                <option value="Yellow">Yellow</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Observations (optional)</label>
              <textarea
                className={inputClass}
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Great ready position; working on backhand contact point…"
              />
            </div>
          </div>
        }
        countFromPreview={(b) => (b.to ? 1 : 0)}
        run={(dryRun) =>
          postEvalFollowupAction({ playerId, level, observations }, { dryRun })
        }
        renderPreview={(b) => (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <Stat label="Recipient" value={b.to} />
              <Stat label="Level" value={b.level} />
              <Stat label="Sessions listed" value={b.sessions_listed} />
            </div>
            <p className="mb-2 text-xs text-ngpa-white/50">
              Subject:{" "}
              <span className="text-ngpa-white/80">{String(b.subject)}</span>
            </p>
            {typeof b.preview_html === "string" && (
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={b.preview_html}
                className="w-full h-72 rounded-lg border border-ngpa-slate/40 bg-white"
              />
            )}
          </>
        )}
      />
    </div>
  );
}
