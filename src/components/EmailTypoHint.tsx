"use client";

import { useMemo } from "react";
import { suggestEmailCorrection } from "@/lib/email-typo";

// Drop-in "Did you mean …?" hint for parent email fields. Render directly
// under the email <input>; when the typed domain is a recognized typo, the
// parent can one-tap apply the correction. Non-blocking — the server also
// normalizes on submit, so this is purely a UX assist.
//
// Usage:
//   <EmailTypoHint email={form.email} onApply={(fixed) => update("email", fixed)} />
export default function EmailTypoHint({
  email,
  onApply,
}: {
  email: string;
  onApply: (corrected: string) => void;
}) {
  const suggestion = useMemo(() => suggestEmailCorrection(email), [email]);
  if (!suggestion) return null;
  return (
    <p className="mt-1 text-sm text-ngpa-white/70">
      Did you mean{" "}
      <button
        type="button"
        className="font-semibold text-ngpa-teal-bright underline underline-offset-2"
        onClick={() => onApply(suggestion)}
      >
        {suggestion}
      </button>
      ?
    </p>
  );
}
