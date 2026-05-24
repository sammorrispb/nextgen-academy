import { c, s } from "./brand";

interface PollVoteConfirmationInput {
  parentFirst: string;
  childFirst: string;
  pollTitle: string;
  vote: "Yes" | "Maybe" | "No";
  minPartySize: number;
}

export function pollVoteConfirmationHtml(
  input: PollVoteConfirmationInput,
): string {
  const { parentFirst, childFirst, pollTitle, vote, minPartySize } = input;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Got your vote, ${escape(parentFirst)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bgDark};">
  <div style="${s.wrapper}">
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">Got it</p>
    <h1 style="${s.heading} margin:0 0 16px 0;">Thanks for voting, ${escape(parentFirst)}.</h1>
    <p style="margin:0 0 20px 0;color:${c.text};line-height:1.55;">
      You voted <strong>${escape(vote)}</strong> for ${escape(childFirst)} on <em>${escape(pollTitle)}</em>. We&rsquo;ll text the group when ${minPartySize} players are locked in and the crew is a go.
    </p>

    <div style="${s.cardAccent}">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${c.accentLime};font-weight:700;">What happens next</p>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.55;">
        Once we hit the headcount, you&rsquo;ll get a follow-up with the first session date and a link to book session 1. From there, locking in 4 weeks at a time is one tap.
      </p>
    </div>

    <div style="${s.footer}">
      <p style="margin:0 0 8px 0;color:${c.muted};font-size:13px;line-height:1.6;">
        Better than yesterday, together.<br>
        <strong style="color:${c.text};">Coach Sam &middot; Next Gen Pickleball Academy</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function pollVoteConfirmationText(input: PollVoteConfirmationInput): string {
  return [
    `Hi ${input.parentFirst},`,
    "",
    `You voted ${input.vote} for ${input.childFirst} on "${input.pollTitle}".`,
    "",
    `We'll text the group when ${input.minPartySize} players are locked in and the crew is a go. You'll get a follow-up with the first session date and a link to book session 1.`,
    "",
    `Coach Sam · Next Gen Pickleball Academy`,
  ].join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
