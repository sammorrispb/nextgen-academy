// Inline styles because email clients don't honor Tailwind classes. Single
// source of truth for the brand chrome that wraps every NGA outbound email
// (admin notifications, parent confirmations, school inquiries, post-eval
// recaps). Pair the color tokens with the style strings below — anything one-
// off can compose against `c.*` directly. See BRAND_GUIDELINES.md for canon.

export const c = {
  bgDark: "#05132B",
  bgCard: "#0C1F47",
  text: "#EEF2FF",
  muted: "#7A88B8",
  link: "#00D4FF",
  border: "#1A3060",
  accentLime: "#AADC00",
  accentYellow: "#FFC107",
} as const;

export const s = {
  wrapper: `font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${c.bgDark}; color: ${c.text}; padding: 32px; border-radius: 12px;`,

  heading: `font-family: Montserrat, Arial, sans-serif; color: ${c.accentLime}; font-size: 22px;`,
  headingYellow: `font-family: Montserrat, Arial, sans-serif; color: ${c.accentYellow}; font-size: 22px;`,

  card: `background: ${c.bgCard}; padding: 20px; border-radius: 8px; margin: 24px 0;`,
  cardAccent: `background: ${c.bgCard}; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${c.accentLime};`,

  cta: `display: inline-block; background: ${c.accentLime}; color: ${c.bgDark}; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700;`,

  link: `color: ${c.link};`,

  footer: `margin-top: 32px; padding-top: 24px; border-top: 1px solid ${c.border};`,

  actionCallout: `margin-top: 24px; padding: 16px; background: ${c.bgCard}; border-radius: 8px; border-left: 4px solid ${c.accentLime};`,
  actionCalloutYellow: `margin-top: 24px; padding: 16px; background: ${c.bgCard}; border-radius: 8px; border-left: 4px solid ${c.accentYellow};`,

  actionLabel: `margin: 0; font-size: 14px; font-weight: 600; color: ${c.accentLime};`,
  actionLabelYellow: `margin: 0; font-size: 14px; font-weight: 600; color: ${c.accentYellow};`,

  tableRow: `border-bottom: 1px solid ${c.border};`,
  tableLabel: `padding: 10px 8px; color: ${c.muted};`,
  tableLabelWide: `padding: 10px 8px; color: ${c.muted}; width: 140px;`,
  tableValue: `padding: 10px 8px; color: ${c.text};`,
} as const;
