import { Resend } from "resend";

// Admin notifications for sign-up invoice lifecycle events that happen
// OUTSIDE the webhook (the webhook only fires on payment). Both of Sam's
// inboxes get these: the academy inbox and his personal inbox, so nothing
// waits on one mailbox.
//
// Usage: call notifyInvoiceSent() from the checkout routes right after
// sendSignupInvoice() succeeds. Failures are logged, never thrown — the
// parent's invoice is already sent and the success page already works.

const ADMIN_NOTIFY = ["nextgenacademypb@gmail.com", "sam.morris2131@gmail.com"];
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";

export interface InvoiceSentNotice {
  kind:
    | "lesson"
    | "monday-girls-dropin"
    | "mvf-junior-tournament";
  headline: string;
  /** Parent name. */
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  amountUsd: string;
  invoiceId: string;
  hostedUrl: string | null;
  dueDate: string;
  /** Extra detail lines, e.g. lesson type / Monday date. */
  details: string[];
}

export async function notifyInvoiceSent(notice: InvoiceSentNotice): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[signup-admin-notify] RESEND_API_KEY missing — skipping invoice-sent notice");
    return;
  }
  const resend = new Resend(apiKey);
  const kindLabel =
    notice.kind === "lesson"
      ? "Lesson"
      : notice.kind === "mvf-junior-tournament"
        ? "MVF Junior Tournament"
        : "Monday Girls drop-in";
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_NOTIFY,
    replyTo: REPLY_TO,
    subject: `Invoice sent — ${kindLabel}: ${notice.childFirstName} (${notice.parentName}) $${notice.amountUsd}`,
    text: [
      `${kindLabel} invoice emailed to the parent — awaiting payment.`,
      ``,
      ...notice.details,
      `Child: ${notice.childFirstName}`,
      `Parent: ${notice.parentName}`,
      `Email: ${notice.parentEmail}`,
      `Phone: ${notice.parentPhone}`,
      ``,
      `Amount: $${notice.amountUsd} — due ${notice.dueDate}`,
      `Stripe invoice: ${notice.invoiceId}`,
      notice.hostedUrl ? `Pay link: ${notice.hostedUrl}` : null,
      ``,
      `You'll get another email here the moment it's paid.`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  });
  if (error) {
    console.error("[signup-admin-notify] invoice-sent notice rejected", error);
  }
}
