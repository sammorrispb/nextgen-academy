import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Liability Waiver & Media Release · Next Gen Pickleball Academy",
  description:
    "Next Gen Pickleball Academy liability waiver, assumption of risk, medical authorization, and photo/media release for youth programs.",
  robots: { index: false, follow: false },
};

const UPDATED = "June 2026";

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="font-heading text-lg font-bold text-ngpa-white">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ngpa-muted">
        {children}
      </div>
    </section>
  );
}

export default function WaiverPage() {
  return (
    <section className="bg-ngpa-navy py-14 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ngpa-teal-bright">
          Next Gen Pickleball Academy
        </p>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-ngpa-white mt-1 tracking-tight">
          Liability Waiver, Assumption of Risk &amp; Media Release
        </h1>
        <p className="mt-2 text-xs text-ngpa-muted">Last updated: {UPDATED}</p>

        <p className="mt-5 text-sm leading-relaxed text-ngpa-muted">
          This agreement applies to participation by a minor child (the
          &ldquo;Participant&rdquo;) in any Next Gen Pickleball Academy
          (&ldquo;NGA&rdquo;) program, including camps, clinics, group sessions,
          and private lessons. By registering a Participant and checking the
          acknowledgment box at checkout, the parent or legal guardian
          (&ldquo;you&rdquo;) agrees to the terms below on the Participant&rsquo;s
          behalf.
        </p>

        <Section n={1} title="Assumption of Risk">
          <p>
            Pickleball and related physical activities involve inherent risks,
            including but not limited to falls, contact with paddles, balls,
            equipment, or other participants, muscle and joint injuries, heat or
            weather exposure, and other risks that cannot be eliminated. You
            understand these risks and voluntarily accept them on behalf of the
            Participant.
          </p>
        </Section>

        <Section n={2} title="Release &amp; Waiver of Liability">
          <p>
            To the fullest extent permitted by law, you release and hold harmless
            NGA, its owner, coaches, employees, volunteers, and facility partners
            from any claims, demands, or causes of action arising out of the
            Participant&rsquo;s participation, except those resulting from gross
            negligence or willful misconduct. This release is binding on you, the
            Participant, and your heirs and representatives.
          </p>
        </Section>

        <Section n={3} title="Medical Authorization &amp; Emergency Care">
          <p>
            You certify the Participant is physically able to participate. In the
            event of injury or illness and if you cannot be reached promptly, you
            authorize NGA staff to secure emergency medical care for the
            Participant, and you accept responsibility for any resulting medical
            costs. You agree to disclose at registration any allergies, medical
            conditions, or medications NGA should know about.
          </p>
        </Section>

        <Section n={4} title="Photo &amp; Media Release">
          <p>
            You grant NGA permission to photograph and record the Participant
            during programs and to use those images and recordings for NGA
            promotional and educational purposes (website, social media, print).
            NGA does not publish camper last names. If you prefer the Participant
            not be featured, email{" "}
            <a
              href="mailto:nextgenacademypb@gmail.com"
              className="text-ngpa-teal-bright underline hover:text-ngpa-teal"
            >
              nextgenacademypb@gmail.com
            </a>{" "}
            and we will honor your request.
          </p>
        </Section>

        <Section n={5} title="Conduct &amp; Dismissal">
          <p>
            Participants are expected to follow coach instructions and treat
            others with respect. NGA may dismiss a Participant for behavior that
            endangers others or repeatedly disrupts the program; fees are not
            refunded in that case.
          </p>
        </Section>

        <Section n={6} title="Weather &amp; Payments">
          <p>
            Camp runs rain or shine. Program fees are non-refundable except where
            NGA cancels a program. Exact program locations are shared with
            registered families before the program begins.
          </p>
        </Section>

        <p className="mt-8 text-sm leading-relaxed text-ngpa-muted">
          By checking the acknowledgment box at registration, you confirm you are
          the Participant&rsquo;s parent or legal guardian, that you have read and
          understand this agreement, and that you agree to it on the
          Participant&rsquo;s behalf.
        </p>

        <p className="mt-6 text-xs text-ngpa-muted/70">
          Questions? Email nextgenacademypb@gmail.com or text Coach Sam at
          301-325-4731.
        </p>

        <div className="mt-8">
          <Link
            href="/camp"
            className="text-sm text-ngpa-teal-bright font-semibold hover:underline"
          >
            ← Back to camp
          </Link>
        </div>
      </div>
    </section>
  );
}
