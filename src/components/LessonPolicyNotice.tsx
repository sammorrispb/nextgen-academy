import Link from "next/link";
import {
  EXISTING_AGREEMENTS_POLICY_TEXT,
  LESSON_NO_SHOW_POLICY_TEXT,
  NGA_REFUND_POLICY_TEXT,
} from "@/data/program-policies";

export default function LessonPolicyNotice() {
  return (
    <div className="mt-5 space-y-3 text-sm text-ngpa-white/75 leading-relaxed">
      <p>{LESSON_NO_SHOW_POLICY_TEXT}</p>
      <p>{NGA_REFUND_POLICY_TEXT}</p>
      <p>{EXISTING_AGREEMENTS_POLICY_TEXT}</p>
      <Link href="/terms" className="inline-block text-ngpa-teal font-bold underline underline-offset-4 hover:text-ngpa-teal-bright">
        Read the program terms
      </Link>
    </div>
  );
}
