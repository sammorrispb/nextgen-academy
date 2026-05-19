/**
 * Single source of truth for the SMS opt-in disclosure.
 *
 * The exact string a parent saw at checkout is snapshotted to the
 * `SMS Consent Text` column on their Drop-in Registrations row. TCPA defenses
 * hinge on being able to produce the verbatim language shown at opt-in time,
 * so this constant must be the same one rendered on screen AND the one stored.
 * If you change the wording, do NOT retroactively rewrite stored snapshots.
 */
export const SMS_CONSENT_TEXT =
  "I agree to receive text messages from Next Gen Pickleball Academy at the " +
  "phone number provided — booking confirmations, reminders, schedule changes, " +
  "and weather cancellations. Message and data rates may apply. Reply STOP to " +
  "opt out, HELP for help. Up to ~4 messages per session week.";
