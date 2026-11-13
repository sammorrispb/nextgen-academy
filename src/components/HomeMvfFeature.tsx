import MvfSessionTwoFeature from "@/components/MvfSessionTwoFeature";
import { MVF_PROGRAMS, upcomingMvfPrograms, type MvfProgram } from "@/data/mvf";

/**
 * The two classes the card describes. Exact keys, not a "fall-2" prefix: the
 * card's dates and registration links are typed into MvfSessionTwoFeature, so
 * a later program that shared the prefix would bring back a card about 2026.
 */
export const HOME_MVF_SESSION_TWO_KEYS: readonly string[] = [
  "fall-2-beginner",
  "fall-2-advanced",
];

export function mvfSessionTwoEnrolling(
  todayIso: string,
  programs: MvfProgram[] = MVF_PROGRAMS,
): boolean {
  return upcomingMvfPrograms(todayIso, programs).some((p) =>
    HOME_MVF_SESSION_TWO_KEYS.includes(p.key),
  );
}

/**
 * The home page's "Enrolling now: Fall Session II" section, shown only while
 * one of those classes is still to come. The whole section goes, not just the
 * card, so an ended session leaves no padded gap. `todayIso` is today in
 * America/New_York.
 */
export default function HomeMvfFeature({
  todayIso,
  programs = MVF_PROGRAMS,
}: {
  todayIso: string;
  programs?: MvfProgram[];
}) {
  if (!mvfSessionTwoEnrolling(todayIso, programs)) return null;

  return (
    <section data-home-block="mvf" className="bg-ngpa-navy py-14 sm:py-20 px-4 sm:px-6 lg:px-10">
      <div className="max-w-6xl mx-auto">
        <MvfSessionTwoFeature section="homepage" />
      </div>
    </section>
  );
}
