export const site = {
  name: "Next Gen Pickleball Academy",
  tagline: "Better than yesterday—together.",
  description:
    "Structured pickleball coaching for kids ages 6–16 in Montgomery County, MD. Group sessions run a court per level — Red, Orange, Green, Yellow — with private lessons at any level.",
  email: "nextgenacademypb@gmail.com",
  phone: "301-325-4731",
  instagram: "https://www.instagram.com/nextgenpickleballacademy",
  website: "https://nextgenpbacademy.com",
  // Community group invites. The Next Gen parent group is this site's own; the
  // Link & Dink group is the adult cross-invite that rides alongside it, the same
  // pairing every recipient-facing email has carried since 2026-08-19.
  //
  // Web surfaces use WhatsApp's `?s=cl&p=i&mlu=2` share params; the email
  // constants in src/lib/email/signature.ts use `?mode=gi_t` on the SAME invite
  // codes and are pinned byte-for-byte by invariant-email-signature.spec.ts.
  // Two shapes, both live, deliberately not unified.
  whatsapp: "https://chat.whatsapp.com/D298cbHYUZo53zdBkbafq8?s=cl&p=i&mlu=2",
  whatsappLinkAndDink:
    "https://chat.whatsapp.com/LaRjBQT8O5p5aJS5vSAk0i?s=cl&p=i&mlu=2",
  boilerplate25:
    "Junior pickleball academy for kids ages 6–16 in Montgomery County, MD — group sessions with a court for every level, plus private lessons at any level.",
  boilerplate50:
    "Next Gen is a junior pickleball academy for kids ages 6–16 in Montgomery County, MD. Group sessions run a court per level — Red, Orange, Green, and Yellow all welcome — with private lessons at any level, and a clear pathway from first paddle touch to tournament-ready play. We partner with parents through clear communication and EASE values — Ethics, Attitude, Skills, Excellence.",
} as const;
