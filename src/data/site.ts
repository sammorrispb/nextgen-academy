export const site = {
  name: "Next Gen Pickleball Academy",
  tagline: "Better than yesterday—together.",
  description:
    "Youth pickleball coaching for kids ages 6–16 in Montgomery County, MD. Lessons, leagues and classes; each program lists its ages, levels and format.",
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
    "Junior pickleball academy for kids ages 6–16 in Montgomery County, MD. Lessons, leagues and classes — each program lists its ages and levels.",
  boilerplate50:
    "Next Gen coaches kids ages 6–16 in Montgomery County, MD, along the Red, Orange, Green and Yellow Ball pathway. Choose lessons, leagues and partner classes; each program lists its ages, levels and format. We work with parents through clear communication and EASE values — Ethics, Attitude, Skills, Excellence — so your player grows with purpose.",
} as const;
