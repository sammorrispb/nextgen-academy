export interface Testimonial {
  quote: string;
  attribution: string;
}

// Existing quotes are withheld while their original sources and website-use
// permission remain unverified. Restore only exact, source-verified wording
// with documented publication permission; prior records remain in git history.
export const testimonials: Testimonial[] = [];
