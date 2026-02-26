export interface Location {
  name: string;
  venue: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mapQuery: string;
}

export const locations: Location[] = [
  {
    name: "Rockville",
    venue: "Dill Dinkers",
    address: "40 Southlawn Court, Suite C",
    city: "Rockville",
    state: "MD",
    zip: "20850",
    mapQuery: "Dill+Dinkers+40+Southlawn+Court+Suite+C+Rockville+MD+20850",
  },
  {
    name: "North Bethesda",
    venue: "Dill Dinkers",
    address: "4942 Boiling Brook Parkway",
    city: "North Bethesda",
    state: "MD",
    zip: "20852",
    mapQuery:
      "Dill+Dinkers+4942+Boiling+Brook+Parkway+North+Bethesda+MD+20852",
  },
];
