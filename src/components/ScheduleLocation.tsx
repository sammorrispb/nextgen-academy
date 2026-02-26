import type { ScheduleLocation as ScheduleLocationType } from "@/data/schedule";
import RegButton from "./RegButton";

interface ScheduleLocationProps {
  location: ScheduleLocationType;
}

export default function ScheduleLocationCard({ location }: ScheduleLocationProps) {
  return (
    <div className="bg-ngpa-panel rounded-2xl p-6 border border-ngpa-slate shadow-sm">
      <h3 className="font-heading text-xl font-bold text-ngpa-white mb-1">
        {location.location}
      </h3>
      <p className="text-sm text-ngpa-muted mb-6">
        {location.venue}, {location.address}
      </p>

      <div className="space-y-6">
        {location.slots.map((slot, si) => (
          <div key={si}>
            <div className="font-mono text-sm font-bold text-ngpa-white mb-3">
              {slot.day} &middot; {slot.time}
            </div>
            <div className="flex flex-wrap gap-2">
              {slot.links.map((link) => (
                <RegButton
                  key={link.level}
                  ballColor={link.level}
                  url={link.url}
                  embedCode={link.embedCode}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
