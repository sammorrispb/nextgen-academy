import Image from 'next/image';
import { getPagePhoto } from '@/data/page-photos';

const frames: Record<string, string> = {
  celebration: 'rounded-t-[45%] rounded-b-3xl border-2 border-ngpa-teal/50 p-2 bg-ngpa-panel shadow-2xl shadow-ngpa-teal/10',
  pathway: 'rounded-3xl border-2 border-ngpa-teal/40 p-3 bg-ngpa-deep',
  editorial: 'rounded-lg border border-ngpa-slate/60 p-3 sm:p-5 bg-ngpa-panel',
  courtside: 'rounded-2xl border-l-4 border-ngpa-teal p-2 bg-ngpa-panel',
  ticket: 'rounded-3xl border-y-2 border-dashed border-ngpa-teal/60 p-3 bg-ngpa-panel',
  activity: 'rounded-2xl border-2 border-dashed border-ngpa-teal/45 p-3 bg-ngpa-panel',
  court: 'rounded-[2rem] border border-ngpa-teal/40 p-2 bg-ngpa-deep shadow-xl',
};

export default function PagePhoto({ page, priority = false }: { page: string; priority?: boolean }) {
  const photo = getPagePhoto(page);
  if (!photo) return null;
  const compact = photo.frame === 'courtside';
  return (
    <figure data-page-photo={page} className={`relative isolate mx-auto my-8 w-full ${compact ? 'max-w-sm' : 'max-w-2xl'} ${frames[photo.frame] ?? frames.court}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={compact ? '(max-width: 640px) 90vw, 384px' : '(max-width: 640px) 90vw, 672px'}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={photo.frame === 'celebration' ? 'w-full h-[320px] sm:h-[480px] object-cover object-center rounded-t-[45%] rounded-b-2xl' : `w-full h-auto object-contain rounded-xl ${compact ? 'max-h-[240px]' : 'max-h-[380px] sm:max-h-[480px]'}`}
      />
      {photo.frame === 'pathway' && (
        <div aria-hidden="true" className="mt-3 flex gap-2">
          <span className="h-1 flex-1 rounded-full bg-ngpa-skill-red" />
          <span className="h-1 flex-1 rounded-full bg-ngpa-skill-orange" />
          <span className="h-1 flex-1 rounded-full bg-ngpa-skill-green" />
          <span className="h-1 flex-1 rounded-full bg-ngpa-skill-yellow" />
        </div>
      )}
      {photo.caption && <figcaption className="px-2 pt-3 text-sm leading-relaxed text-ngpa-white/65">{photo.caption}</figcaption>}
    </figure>
  );
}
