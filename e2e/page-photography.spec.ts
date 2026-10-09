import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pagePhotos, getPagePhoto } from '../src/data/page-photos';
import PagePhoto from '../src/components/PagePhoto';
import { blogPosts } from '../src/data/blog';
import { CAMPS } from '../src/data/camps';
import { CLUSTERS } from '../src/data/clusters';

test('each editorial page has a distinct, accessible original', () => {
  const entries = Object.entries(pagePhotos);
  expect(entries.length).toBeGreaterThan(50);
  expect(new Set(entries.map(([, photo]) => photo.originalSha256)).size).toBe(entries.length);
  for (const [key, photo] of entries) {
    expect(key).toMatch(/^\//);
    expect(photo.alt.trim().length).toBeGreaterThan(15);
    expect(photo.width).toBeGreaterThan(300);
    expect(photo.height).toBeGreaterThan(300);
    expect(photo.originalSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(resolve('public', photo.src.slice(1)))).toBe(true);
    expect(photo.source).toMatch(/^Photos:|^Existing NGA:/);
    const asset = readFileSync(resolve('public', photo.src.slice(1)));
    expect(asset.includes(Buffer.from('EXIF'))).toBe(false);
  }
});

test('published articles, camps and clusters have explicit individual assignments', () => {
  for (const post of blogPosts) expect(getPagePhoto(`/blog/${post.slug}`)).toBeDefined();
  for (const camp of CAMPS) expect(getPagePhoto(`/camp/${camp.slug}`)).toBeDefined();
  for (const cluster of CLUSTERS) expect(getPagePhoto(`/clusters/${cluster.slug}`)).toBeDefined();
});

test('unknown editorial records and private tokens never borrow an image', () => {
  for (const key of ['', '/blog/not-published', '/camp/not-published', '/commit/private-secret']) {
    expect(getPagePhoto(key)).toBeUndefined();
    expect(PagePhoto({ page: key })).toBeNull();
  }
});
