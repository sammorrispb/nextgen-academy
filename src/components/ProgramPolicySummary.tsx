import Link from "next/link";
import { FALL_WEATHER_CALL_POLICY } from "@/lib/fall-calls";
import { MVF_JUNIOR_TOURNAMENT_DATE_LABEL, NO_REFUNDS_TEXT, RAIN_OR_SHINE_TEXT } from "@/data/mvf-junior-tournament-2026";
import { EXISTING_AGREEMENTS_POLICY_TEXT, LESSON_NO_SHOW_POLICY_TEXT, NGA_REFUND_POLICY_TEXT } from "@/data/program-policies";

// Scope verified policies to the program that sold them. Sources confirmed
// 2026-10-06: published Oct 5 WJ guide (Notion 3edfa3ac27dc8126a600d602eb1072ff)
// and MVF tournament guide (3edfa3ac27dc815a84bff3173b622a6b).
// This summary does not replace terms previously supplied to a family.
export default function ProgramPolicySummary() {
  const policies = [
    {
      title: "Walter Johnson Sunday season · Fall 2026",
      href: "/fall",
      detail: `For existing registrations, the supplied season terms make parent withdrawals non-refundable and provide a refund for NGA-cancelled sessions NGA cannot make up. ${FALL_WEATHER_CALL_POLICY} All times are Eastern. Check the fall page and your season WhatsApp group; cancelled groups also receive an email. A weather cancellation moves to the next open make-up date for that group. New NGA-controlled offers using these terms follow the case-by-case refund review above.`,
    },
    {
      title: `MVF Junior Tournament · ${MVF_JUNIOR_TOURNAMENT_DATE_LABEL}`,
      href: "/mvf-junior-tournament",
      detail: `For existing registrations, the supplied tournament terms state: ${NO_REFUNDS_TEXT} ${RAIN_OR_SHINE_TEXT} NGA sends an invoice after registration; payment locks the spot. The Walter Johnson make-up policy does not apply to this tournament. New NGA-controlled offers using these terms follow the case-by-case refund review above.`,
    },
    {
      title: "MVF Thursday classes",
      href: "/montgomery-village-youth-pickleball",
      detail: "MVF handles registration and payment. Check the specific MVF activity for its cancellation, weather and refund terms, and confirm the venue with MVF before travelling.",
    },
    {
      title: "The Pickl Park Saturday league",
      href: "/picklpark",
      detail: "The Pickl Park handles registration and payment. Confirm current fees, availability and cancellation terms with the host before registering.",
    },
    {
      title: "Private and group lessons",
      href: "/lessons",
      detail: `Submitting a lesson request proposes a time; it does not reserve a lesson or charge you. Coach Sam confirms the time and court before sending an invoice. ${LESSON_NO_SHOW_POLICY_TEXT} Confirm the cancellation and rescheduling terms before paying.`,
    },
    {
      title: "Winter programs",
      href: "/league",
      detail: "Winter details and host arrangements are still being confirmed. Interest is welcome; registration is not open. Dates, format, price and cancellation terms will be confirmed before registration opens.",
    },
  ];

  return (
    <div className="space-y-5">
      <p>{NGA_REFUND_POLICY_TEXT}</p>
      <p>{EXISTING_AGREEMENTS_POLICY_TEXT} This summary does not replace those terms.</p>
      <ul className="space-y-5">
        {policies.map((policy) => (
          <li key={policy.href}>
            <Link href={policy.href} className="text-ngpa-teal-bright font-bold underline underline-offset-4 hover:text-ngpa-teal">
              {policy.title}
            </Link>
            <p className="mt-1">{policy.detail}</p>
          </li>
        ))}
      </ul>
      <p>
        Drop-ins, crews and camps: new NGA-controlled offers using these terms
        follow the case-by-case refund review above. Review the specific listing,
        offer and checkout before paying. Contact Coach Sam if a rule is missing,
        unclear or conflicts with this summary.
      </p>
    </div>
  );
}
