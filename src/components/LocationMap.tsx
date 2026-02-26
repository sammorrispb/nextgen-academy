import type { Location } from "@/data/locations";

interface LocationMapProps {
  location: Location;
}

export default function LocationMap({ location }: LocationMapProps) {
  return (
    <div className="bg-ngpa-panel rounded-2xl overflow-hidden border border-ngpa-slate shadow-sm">
      <iframe
        title={`${location.venue} ${location.name} map`}
        src={`https://www.google.com/maps?q=${location.mapQuery}&output=embed`}
        className="w-full h-48 sm:h-56"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ border: 0 }}
      />
      <div className="p-4">
        <h4 className="font-heading font-bold text-ngpa-white">{location.name}</h4>
        <p className="text-sm text-ngpa-muted">
          {location.venue}, {location.address}
        </p>
        <p className="text-sm text-ngpa-muted">
          {location.city}, {location.state} {location.zip}
        </p>
      </div>
    </div>
  );
}
