import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const PROOF_DIR = fileURLToPath(
  new URL('../../.mastracode/plans/homestead-omen-rewrite.proof/', import.meta.url),
);

test('automation era: buy CapEx and feed a crop via real UI', async ({ page, context }, testInfo) => {
  testInfo.setTimeout(60_000);
  mkdirSync(PROOF_DIR, { recursive: true });
  await context.tracing.startChunk();

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?seed=42');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);

  const canvas = page.locator('#game-canvas');
  const centerClick = async () => {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };

  await expect(page.getByTestId('hud-gold')).toContainText('200');
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('farm-supply')).toHaveClass(/open/);

  // A plot is the affordable starting CapEx purchase: 180 gold and two rows.
  await page.getByTestId('buy-upgrade-plot').click();
  await expect(page.getByTestId('hud-gold')).toContainText('20');
  await expect(page.getByTestId('buy-upgrade-plot')).toContainText('270 gold');

  // Buy one plant-food consumable with the remaining cash.
  await page.getByTestId('buy-feed-1').click();
  await expect(page.getByTestId('hud-gold')).toContainText('8');
  await expect(page.getByTestId('plant-food')).toContainText('6');
  await page.getByTestId('close-shop').click();

  // Plant in spring, advance to summer, then apply feed through the tile tool.
  await centerClick();
  const day = page.getByTestId('hud-day');
  while (!(await day.textContent())!.includes('Summer')) {
    await page.getByTestId('end-day').click();
  }
  await page.getByTestId('tool-feed').click();
  await centerClick();
  await expect(page.getByTestId('plant-food')).toContainText('5');

  await page.screenshot({ path: `${PROOF_DIR}segment4-automation-era.png`, fullPage: true });
  await context.tracing.stopChunk({ path: `${PROOF_DIR}segment4-automation-era-trace.zip` });

  expect(pageErrors).toEqual([]);
});
