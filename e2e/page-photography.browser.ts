import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pagePhotos } from '../src/data/page-photos';

const evidence = process.env.PHOTO_REVIEW_DIR ?? 'test-results/photo-review';
// These templates require signed links. Exercise their error states without accessing real tokens.
const signedTemplates = new Set(['/lessons/book', '/lessons/book/respond', '/schedule/cancel']);
const publicRoutes = Object.keys(pagePhotos).filter(route => !route.includes('[') && !signedTemplates.has(route));
const screenshots = new Set(['/', '/levels', '/fall', '/camp/june-29', '/clusters/down-county', '/blog/first-pickleball-session-what-to-expect', '/camp/success', '/lessons/success']);

test('all public page photos decode within the viewport and retain a next step', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route('**/api/analytics', route => route.fulfill({status: 204}));
  const rows = [];
  const assignedSources = new Set<string>();
  for (const route of publicRoutes) {
    const response = await page.goto(route, {waitUntil: 'domcontentloaded'});
    expect(response?.status(), route).toBe(200);
    const figure = page.locator(`[data-page-photo="${route}"]`);
    await expect(figure, `${route} editorial image`).toHaveCount(1);
    await figure.scrollIntoViewIfNeeded();
    const image = figure.locator('img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveAttribute('alt', pagePhotos[route].alt);
    const measurements = await figure.evaluate(node => {
      const img = node.querySelector('img')!;
      const rect = node.getBoundingClientRect();
      const source = new URL(img.currentSrc || img.src, document.baseURI);
      const renderedSource = source.searchParams.get('url') ?? source.pathname;
      return {renderedSource, left: rect.left, right: rect.right, image: img.getAttribute('src'), width: img.naturalWidth, height: img.naturalHeight, figureTop: rect.top};
    });
    expect(measurements.renderedSource, `${route} assigned source`).toBe(pagePhotos[route].src);
    expect(measurements.left, `${route} left frame edge`).toBeGreaterThanOrEqual(-1);
    expect(measurements.right, `${route} right frame edge`).toBeLessThanOrEqual(testInfo.project.use.viewport!.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} page overflow`).toBe(true);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(await page.getByRole('link').count(), `${route} usable navigation`).toBeGreaterThan(0);
    // Route assignments must remain distinct across all concrete public records.
    expect(assignedSources.has(pagePhotos[route].originalSha256), `${route} duplicate original`).toBe(false);
    assignedSources.add(pagePhotos[route].originalSha256);
    if (route.endsWith('/success')) {
      const afterHeading = await page.evaluate(() => !!(document.querySelector('h1')!.compareDocumentPosition(document.querySelector('[data-page-photo]')!) & Node.DOCUMENT_POSITION_FOLLOWING));
      expect(afterHeading, `${route} truthful status precedes photograph`).toBe(true);
    }
    mkdirSync(evidence, {recursive:true});
    if (screenshots.has(route)) {
      await page.evaluate(() => window.scrollTo({top: 0}));
      await page.screenshot({path: `${evidence}/${route.replaceAll('/', '-') || 'home'}-${testInfo.project.name}.png`});
      await figure.evaluate(node => node.scrollIntoView({block: 'center'}));
      await figure.screenshot({path: `${evidence}/${route.replaceAll('/', '-') || 'home'}-photo-${testInfo.project.name}.png`});
    }
    rows.push({route, status: response?.status(), original: pagePhotos[route].originalSha256, decoded: true, overflow: false, ...measurements});
  }
  writeFileSync(`${evidence}/browser-${testInfo.project.name}.json`, JSON.stringify(rows, null, 2));
});

test('invalid or unavailable signed links retain their error message without an editorial photo', async ({ page }, testInfo) => {
  const paths = ['/commit/synthetic-invalid', '/commit/synthetic-invalid/success', '/fall/standings/synthetic-group/synthetic-invalid', '/lessons/book?token=synthetic-invalid', '/lessons/book/respond?token=synthetic-invalid', '/schedule/cancel?token=synthetic-invalid', '/schedule/synthetic-missing-session', '/poll/synthetic-missing-poll'];
  const rows = [];
  for (const path of paths) {
    const response = await page.goto(path, {waitUntil:'domcontentloaded'});
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('[data-page-photo]'), path).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    rows.push({path, status: response?.status(), photoCount: 0});
  }
  mkdirSync(evidence, {recursive:true});
  writeFileSync(`${evidence}/invalid-links-${testInfo.project.name}.json`, JSON.stringify(rows, null, 2));
});
