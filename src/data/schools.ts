// MCPS schools (high + middle) bucketed into the four NGA cluster areas.
// Compiled 2026-06-09 from the official MCPS cluster pages
// (montgomeryschoolsmd.org/departments/clusteradmin/clusters/) — 2025–26
// school year structure.
//
// Bucketing is by GEOGRAPHY of the community served, not by MCPS consortium
// name. In particular, MCPS's own "Downcounty Consortium" (Blair, Einstein,
// Kennedy, Northwood, Wheaton) serves the Silver Spring / Wheaton corridor —
// that's the NGA East-County area, NOT NGA Down-County (Bethesda / Chevy
// Chase / North Bethesda).
//
// Known churn ahead (revisit before the 2027–28 school year):
//   - Crown HS (Gaithersburg) opens Aug 2027; the 2026-03 board vote moves
//     Wootton HS into the Crown building (legal challenges pending).
//   - Northwood HS students are temporarily housed at the Woodward facility
//     in Rockville during the rebuild; Woodward reopens as its own HS in 2027.
//   - Countywide boundary study lands 2027–28.
// Thomas Edison HS of Technology (countywide application CTE school) is
// excluded — it has no geographic cluster.

import type { ClusterSlug } from "./clusters";

export type SchoolLevel = "high" | "middle";

export interface School {
  name: string;
  level: SchoolLevel;
  /** Town/community served (not always the postal city). */
  town: string;
  /** NGA cluster area this school's community falls in. */
  cluster: ClusterSlug;
  /**
   * MCPS cluster or consortium the school belongs to — e.g. "Whitman",
   * "Downcounty Consortium". Consortium middle schools feed the consortium's
   * high schools as a choice pool, not one fixed high school.
   */
  mcpsCluster: string;
}

export const SCHOOLS: readonly School[] = [
  // ── Down-County (Bethesda · North Bethesda · Chevy Chase) ──────────
  { name: "Bethesda-Chevy Chase High School", level: "high", town: "Bethesda", cluster: "down-county", mcpsCluster: "Bethesda-Chevy Chase" },
  { name: "Walt Whitman High School", level: "high", town: "Bethesda", cluster: "down-county", mcpsCluster: "Whitman" },
  { name: "Walter Johnson High School", level: "high", town: "North Bethesda", cluster: "down-county", mcpsCluster: "Walter Johnson" },
  { name: "Westland Middle School", level: "middle", town: "Bethesda", cluster: "down-county", mcpsCluster: "Bethesda-Chevy Chase" },
  { name: "Silver Creek Middle School", level: "middle", town: "Kensington", cluster: "down-county", mcpsCluster: "Bethesda-Chevy Chase" },
  { name: "Thomas W. Pyle Middle School", level: "middle", town: "Bethesda", cluster: "down-county", mcpsCluster: "Whitman" },
  { name: "North Bethesda Middle School", level: "middle", town: "Bethesda", cluster: "down-county", mcpsCluster: "Walter Johnson" },
  { name: "Tilden Middle School", level: "middle", town: "North Bethesda", cluster: "down-county", mcpsCluster: "Walter Johnson" },

  // ── Up-County (Gaithersburg · Germantown · Clarksburg) ─────────────
  { name: "Gaithersburg High School", level: "high", town: "Gaithersburg", cluster: "up-county", mcpsCluster: "Gaithersburg" },
  { name: "Watkins Mill High School", level: "high", town: "Montgomery Village", cluster: "up-county", mcpsCluster: "Watkins Mill" },
  { name: "Quince Orchard High School", level: "high", town: "Gaithersburg", cluster: "up-county", mcpsCluster: "Quince Orchard" },
  { name: "Northwest High School", level: "high", town: "Germantown", cluster: "up-county", mcpsCluster: "Northwest" },
  { name: "Seneca Valley High School", level: "high", town: "Germantown", cluster: "up-county", mcpsCluster: "Seneca Valley" },
  { name: "Clarksburg High School", level: "high", town: "Clarksburg", cluster: "up-county", mcpsCluster: "Clarksburg" },
  { name: "Damascus High School", level: "high", town: "Damascus", cluster: "up-county", mcpsCluster: "Damascus" },
  { name: "Poolesville High School", level: "high", town: "Poolesville", cluster: "up-county", mcpsCluster: "Poolesville" },
  { name: "Gaithersburg Middle School", level: "middle", town: "Gaithersburg", cluster: "up-county", mcpsCluster: "Gaithersburg" },
  { name: "Forest Oak Middle School", level: "middle", town: "Gaithersburg", cluster: "up-county", mcpsCluster: "Gaithersburg" },
  { name: "Montgomery Village Middle School", level: "middle", town: "Montgomery Village", cluster: "up-county", mcpsCluster: "Watkins Mill" },
  { name: "Neelsville Middle School", level: "middle", town: "Germantown", cluster: "up-county", mcpsCluster: "Seneca Valley / Watkins Mill" },
  { name: "Lakelands Park Middle School", level: "middle", town: "Gaithersburg", cluster: "up-county", mcpsCluster: "Quince Orchard / Northwest" },
  { name: "Ridgeview Middle School", level: "middle", town: "Gaithersburg", cluster: "up-county", mcpsCluster: "Quince Orchard" },
  { name: "Kingsview Middle School", level: "middle", town: "Germantown", cluster: "up-county", mcpsCluster: "Northwest" },
  { name: "Roberto W. Clemente Middle School", level: "middle", town: "Germantown", cluster: "up-county", mcpsCluster: "Northwest / Seneca Valley" },
  { name: "Dr. Martin Luther King Jr. Middle School", level: "middle", town: "Germantown", cluster: "up-county", mcpsCluster: "Seneca Valley" },
  { name: "Rocky Hill Middle School", level: "middle", town: "Clarksburg", cluster: "up-county", mcpsCluster: "Clarksburg" },
  { name: "Hallie Wells Middle School", level: "middle", town: "Clarksburg", cluster: "up-county", mcpsCluster: "Clarksburg / Damascus" },
  { name: "John T. Baker Middle School", level: "middle", town: "Damascus", cluster: "up-county", mcpsCluster: "Damascus" },
  { name: "John Poole Middle School", level: "middle", town: "Poolesville", cluster: "up-county", mcpsCluster: "Poolesville" },

  // ── East-County (Olney · Silver Spring) ────────────────────────────
  { name: "Sherwood High School", level: "high", town: "Sandy Spring", cluster: "east-county", mcpsCluster: "Sherwood" },
  { name: "James Hubert Blake High School", level: "high", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "Paint Branch High School", level: "high", town: "Burtonsville", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "Springbrook High School", level: "high", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "Montgomery Blair High School", level: "high", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "John F. Kennedy High School", level: "high", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Wheaton High School", level: "high", town: "Wheaton", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Northwood High School", level: "high", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Albert Einstein High School", level: "high", town: "Kensington", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Rosa M. Parks Middle School", level: "middle", town: "Olney", cluster: "east-county", mcpsCluster: "Sherwood" },
  { name: "William H. Farquhar Middle School", level: "middle", town: "Olney", cluster: "east-county", mcpsCluster: "Sherwood / Northeast Consortium" },
  { name: "Benjamin Banneker Middle School", level: "middle", town: "Burtonsville", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "Briggs Chaney Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "Francis Scott Key Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "White Oak Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Northeast Consortium" },
  { name: "Argyle Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Eastern Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "A. Mario Loiederman Middle School", level: "middle", town: "Wheaton", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Newport Mill Middle School", level: "middle", town: "Kensington", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Odessa Shannon Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Parkland Middle School", level: "middle", town: "Aspen Hill", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Silver Spring International Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Sligo Middle School", level: "middle", town: "Silver Spring", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },
  { name: "Takoma Park Middle School", level: "middle", town: "Takoma Park", cluster: "east-county", mcpsCluster: "Downcounty Consortium" },

  // ── Mid-County (Rockville · Potomac) ───────────────────────────────
  { name: "Winston Churchill High School", level: "high", town: "Potomac", cluster: "mid-county", mcpsCluster: "Churchill" },
  { name: "Thomas S. Wootton High School", level: "high", town: "Rockville", cluster: "mid-county", mcpsCluster: "Wootton" },
  { name: "Richard Montgomery High School", level: "high", town: "Rockville", cluster: "mid-county", mcpsCluster: "Richard Montgomery" },
  { name: "Rockville High School", level: "high", town: "Rockville", cluster: "mid-county", mcpsCluster: "Rockville" },
  { name: "Col. Zadok Magruder High School", level: "high", town: "Derwood", cluster: "mid-county", mcpsCluster: "Magruder" },
  { name: "Herbert Hoover Middle School", level: "middle", town: "Potomac", cluster: "mid-county", mcpsCluster: "Churchill" },
  { name: "Cabin John Middle School", level: "middle", town: "Potomac", cluster: "mid-county", mcpsCluster: "Churchill / Wootton" },
  { name: "Robert Frost Middle School", level: "middle", town: "Rockville", cluster: "mid-county", mcpsCluster: "Wootton" },
  { name: "Julius West Middle School", level: "middle", town: "Rockville", cluster: "mid-county", mcpsCluster: "Richard Montgomery" },
  { name: "Earle B. Wood Middle School", level: "middle", town: "Rockville", cluster: "mid-county", mcpsCluster: "Rockville" },
  { name: "Redland Middle School", level: "middle", town: "Derwood", cluster: "mid-county", mcpsCluster: "Magruder" },
  { name: "Shady Grove Middle School", level: "middle", town: "Derwood", cluster: "mid-county", mcpsCluster: "Magruder" },
] as const;
