import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Session proof artifacts (never committed; see main plan's proof rules).
const PROOF_DIR = fileURLToPath(
  new URL('../../.mastracode/plans/homestead-omen-rewrite.proof/', import.meta.url),
);

/**
 * Manual-era proof flow — mirrors the human play script in the proof README,
 * driving only visible UI controls: plant a wheat seed by clicking the field,
 * end days through spring, water before each summer day advance, then harvest
 * in fall. Fixed seed via URL param keeps weather deterministic.
 */
test('manual era: plant, water daily, harvest via real UI', async ({ page, context }, testInfo) => {
  testInfo.setTimeout(60_000);
  mkdirSync(PROOF_DIR, { recursive: true });
  // The config already starts tracing (retain-on-failure); record this flow
  // as an explicit chunk so the proof trace exists even on success.
  await context.tracing.startChunk();

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?seed=42');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);

  const canvas = page.locator('#game-canvas');
  const day = page.getByTestId('hud-day');
  const endDay = page.getByTestId('end-day');
  const centerClick = async () => {
    const box = (await canvas.boundingBox())!;
    // Screen center ≈ world origin, inside the 10×10 field.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };

  // Spring day 1: plant wheat on the central tile (plant tool is default).
  await expect(day).toContainText('Spring 1');
  await expect(page.getByTestId('seeds-wheat')).toContainText('10 seeds');
  await centerClick();
  await expect(page.getByTestId('seeds-wheat')).toContainText('9 seeds');

  // Advance through spring (crops auto-water and grow in spring).
  while (!(await day.textContent())!.includes('Summer')) {
    await endDay.click();
  }

  // Summer: water the crop before each day advance so it never withers.
  await page.getByTestId('tool-water').click();
  while ((await day.textContent())!.includes('Summer')) {
    await centerClick();
    await endDay.click();
  }

  // Fall: harvest the mature crop into the silo.
  await expect(day).toContainText('Fall');
  await expect(page.getByTestId('hud-storage')).toContainText('0/100');
  await page.getByTestId('tool-harvest').click();
  await centerClick();
  await expect(page.getByTestId('hud-storage')).toContainText('1/100');
  await expect(page.getByTestId('seeds-wheat')).toContainText('1 stored');

  await page.screenshot({ path: `${PROOF_DIR}segment3-manual-era.png`, fullPage: true });
  await context.tracing.stopChunk({ path: `${PROOF_DIR}segment3-manual-era-trace.zip` });

  expect(pageErrors).toEqual([]);
});
