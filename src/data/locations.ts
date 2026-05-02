export interface Location {
  name: string;
  blurb: string;
}

// NGA locations rotate seasonally — there is no fixed venue.
// Lead capture replaces facility-specific routing.
export const locations: Location[] = [];
