import MvfSessionTwoFeature from "@/components/MvfSessionTwoFeature";
import { upcomingMvfPrograms } from "@/data/mvf";

/**
 * The home page's "Enrolling now: Fall Session II" section, shown only while a
 * Session II class is still to come: the same gate the Montgomery Village page
 * puts on this card. The whole section goes, not just the card, so an ended
 * session leaves no padded gap. `todayIso` is today in America/New_York.
 */
export default function HomeMvfFeature({ todayIso }: { todayIso: string }) {
  const enrolling = upcomingMvfPrograms(todayIso).some((p) =>
    p.key.startsWith("fall-2"),
  );
  if (!enrolling) return null;

  return (
    <section className="bg-ngpa-navy py-14 sm:py-20 px-4 sm:px-6 lg:px-10">
      <div className="max-w-6xl mx-auto">
        <MvfSessionTwoFeature section="homepage" />
      </div>
    </section>
  );
}
