// Single source of truth for the NGA liability/media waiver — the text, the
// version string, and the "last updated" label. Rendered by the static
// /waiver page, the /waiver/sign e-signature page, and the signed-waiver
// confirmation email, so all three always agree on the exact terms a parent
// agreed to. Bump WAIVER_VERSION (and WAIVER_UPDATED) whenever the copy below
// changes — the version is stamped onto every signed row for audit.

export const WAIVER_VERSION = "2026-06";
export const WAIVER_UPDATED = "June 2026";

export const WAIVER_CONTACT_EMAIL = "nextgenacademypb@gmail.com";
export const WAIVER_CONTACT_PHONE = "301-325-4731";

export const WAIVER_INTRO =
  "This agreement applies to participation by a minor child (the “Participant”) in any Next Gen Pickleball Academy (“NGA”) program, including camps, clinics, group sessions, and private lessons. By signing as the parent or legal guardian (“you”), you agree to the terms below on the Participant’s behalf. One signed waiver covers the Participant for all NGA programs — you only sign once.";

export interface WaiverSection {
  n: number;
  title: string;
  body: string;
}

export const WAIVER_SECTIONS: WaiverSection[] = [
  {
    n: 1,
    title: "Assumption of Risk",
    body: "Pickleball and related physical activities involve inherent risks, including but not limited to falls, contact with paddles, balls, equipment, or other participants, muscle and joint injuries, heat or weather exposure, and other risks that cannot be eliminated. You understand these risks and voluntarily accept them on behalf of the Participant.",
  },
  {
    n: 2,
    title: "Release & Waiver of Liability",
    body: "To the fullest extent permitted by law, you release and hold harmless NGA, its owner, coaches, employees, volunteers, and facility partners from any claims, demands, or causes of action arising out of the Participant’s participation, except those resulting from gross negligence or willful misconduct. This release is binding on you, the Participant, and your heirs and representatives.",
  },
  {
    n: 3,
    title: "Medical Authorization & Emergency Care",
    body: "You certify the Participant is physically able to participate. In the event of injury or illness and if you cannot be reached promptly, you authorize NGA staff to secure emergency medical care for the Participant, and you accept responsibility for any resulting medical costs. You agree to disclose at registration any allergies, medical conditions, or medications NGA should know about.",
  },
  {
    n: 4,
    title: "Photo & Media Release",
    body: `You grant NGA permission to photograph and record the Participant during programs and to use those images and recordings for NGA promotional and educational purposes (website, social media, print). NGA does not publish camper last names. If you prefer the Participant not be featured, email ${WAIVER_CONTACT_EMAIL} and we will honor your request.`,
  },
  {
    n: 5,
    title: "Conduct & Dismissal",
    body: "Participants are expected to follow coach instructions and treat others with respect. NGA may dismiss a Participant for behavior that endangers others or repeatedly disrupts the program; fees are not refunded in that case.",
  },
  {
    n: 6,
    title: "Weather & Payments",
    body: "Programs run rain or shine. Program fees are non-refundable except where NGA cancels a program. Exact program locations are shared with registered families before the program begins.",
  },
];

// The attestation a parent agrees to when they type their name and submit.
export const WAIVER_ACK =
  "you confirm you are the Participant’s parent or legal guardian, that you have read and understand this agreement, and that you agree to it on the Participant’s behalf.";
