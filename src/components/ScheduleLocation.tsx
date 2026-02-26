import type { ScheduleLocation as ScheduleLocationType } from "@/data/schedule";
import RegButton from "./RegButton";

interface ScheduleLocationProps {
  location: ScheduleLocationType;
}

export default function ScheduleLocationCard({ location }: ScheduleLocationProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <h3 className="font-heading text-xl font-bold text-gray-900 mb-1">
        {location.location}
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        {location.venue}, {location.address}
      </p>

      <div className="space-y-6">
        {location.slots.map((slot, si) => (
          <div key={si}>
            <div className="font-heading text-sm font-bold text-gray-900 mb-3">
              {slot.day} &middot; {slot.time}
            </div>
            <div className="flex flex-wrap gap-2">
              {slot.links.map((link) => (
                <RegButton
                  key={link.level}
                  ballColor={link.level}
                  url={link.url}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
