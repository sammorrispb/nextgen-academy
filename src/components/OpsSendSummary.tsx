/** Keep successful delivery distinct from CRM reconciliation: do not resend. */
export default function OpsSendSummary({ body, hasFailedEmails }: {
  body: Record<string, unknown>;
  hasFailedEmails: boolean;
}) {
  const crmUpdateFailed = body.notion_updated === false;
  const summary = typeof body.sent === "number"
    ? `Sent ${body.sent}, failed ${body.failed ?? 0}.`
    : `Sent to ${String(body.sent_to ?? "recipient")}.`;
  return (
    <p className={`text-sm font-bold ${hasFailedEmails || crmUpdateFailed ? "text-ngpa-red" : "text-ngpa-skill-green"}`}>
      {summary}{" "}
      {crmUpdateFailed
        ? "Email sent; CRM update failed. Repair the CRM record only; do not resend this email."
        : "Run a fresh preview before sending again."}
    </p>
  );
}
