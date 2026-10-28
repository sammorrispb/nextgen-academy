import { escapeHtml } from "@/lib/html";

export interface NewsletterAdminInput {
  parentName: string;
  email: string;
  childAge: number | string;
  notionStatus: string;
}

// Internal admin notification for a newsletter signup. parentName and email are
// attacker-controlled (the form only validates parentName is non-empty and that
// email matches a pattern), so both are escaped before interpolation — every
// other NGA lead form does this, and schools-lead's own comment is the reason:
// escape them all, or the form relays phishing markup from our sending domain.
// childAge is numeric and notionStatus is server-generated.
export function newsletterAdminHtml(input: NewsletterAdminInput): string {
  const parentName = escapeHtml(input.parentName);
  const email = escapeHtml(input.email);
  const childAge = escapeHtml(String(input.childAge));
  const notionStatus = escapeHtml(input.notionStatus);
  return `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #05132B; color: #EEF2FF; padding: 32px; border-radius: 12px;">
  <h1 style="font-family: Montserrat, Arial, sans-serif; color: #AADC00; font-size: 22px; margin-bottom: 24px;">
    New Newsletter Signup
  </h1>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8; width: 140px;">Parent</td><td style="padding: 10px 8px; color: #EEF2FF;">${parentName}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Email</td><td style="padding: 10px 8px;"><a href="mailto:${email}" style="color: #00D4FF;">${email}</a></td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Child Age</td><td style="padding: 10px 8px; color: #EEF2FF;">${childAge}</td></tr>
    <tr style="border-bottom: 1px solid #1A3060;"><td style="padding: 10px 8px; color: #7A88B8;">Notion DB</td><td style="padding: 10px 8px; color: #EEF2FF;">${notionStatus}</td></tr>
  </table>
</div>`;
}
