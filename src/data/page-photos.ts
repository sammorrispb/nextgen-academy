import registry from './page-photos.json';

export type PagePhotoData = {
  src: string;
  alt: string;
  width: number;
  height: number;
  originalSha256: string;
  source: string;
  frame: string;
  caption?: string;
};

export const pagePhotos: Readonly<Record<string, PagePhotoData>> = registry;

// Only public editorial keys or literal flow templates are accepted here.
export function getPagePhoto(page: string): PagePhotoData | undefined {
  return Object.hasOwn(pagePhotos, page) ? pagePhotos[page] : undefined;
}
