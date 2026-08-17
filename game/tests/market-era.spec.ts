import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const PROOF_DIR = fileURLToPath(
  new URL('../../.mastracode/plans/homestead-omen-rewrite.proof/', import.meta.url),
);

/**
 * Market-era proof flow (seed 42) — mirrors the human play script, driving
 * only visible UI controls. Seed 42's initial offer board contains
 * "wheat q12 p30 due day 14", which this flow accepts and delivers.
 *
 * Year 1: buy 10 extra wheat seeds, plant 20 wheat, water through summer,
 * harvest 20 in fall. The contract settles at the day 13→14 tick for exactly
 * 12 × 30 = 360 gold (outside the elevator cap). Winter: sell the rest at the
 * elevator. Amendment A-001: the sale income funds a sprinkler (500 gold);
 * year 2 verifies sprinklers auto-water and charge OpEx via the day report.
 */
test('market era: contracts, elevator selling, and sprinkler OpEx via real UI', async ({ page, context }, testInfo) => {
  testInfo.setTimeout(120_000);
  mkdirSync(PROOF_DIR, { recursive: true });
  await context.tracing.startChunk();

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?seed=42');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);

  const day = page.getByTestId('hud-day');
  const endDay = page.getByTestId('end-day');
  const gold = async () =>
    Number((await page.getByTestId('hud-gold').textContent())!.replace(/\D/g, ''));

  // Click a specific farm tile via real mouse input at projected coordinates.
  const clickTile = async (gx: number, gy: number) => {
    const pos = await page.evaluate(
      ([x, y]) => window.__THREE_GAME_DIAGNOSTICS__!.worldToScreen!(x, y),
      [gx, gy],
    );
    await page.mouse.click(pos.x, pos.y);
  };

  // --- Spring day 1: accept the wheat contract (q12 @ 30, due day 14). ---
  await expect(day).toContainText('Spring 1');
  await page.getByTestId('open-market').click();
  const offers = page.getByTestId('contract-offers');
  await expect(offers).toContainText('12 Wheat');
  await expect(offers).toContainText('30 gold each · due day 14');
  const wheatOffer = page.locator('[data-testid="contract-offers"] .shop-card', {
    hasText: '12 Wheat',
  });
  await wheatOffer.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('active-contracts')).toContainText('12 Wheat @ 30 gold · due day 14');
  await page.getByTestId('close-market').click();

  // Buy 10 extra wheat seeds (2×5) so we can plant 20.
  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-wheat-5').click();
  await page.getByTestId('buy-wheat-5').click();
  await expect(page.getByTestId('seeds-wheat')).toContainText('20 seeds');
  await page.getByTestId('close-shop').click();
  expect(await gold()).toBe(100); // 200 − 10×10 seeds

  // Plant 20 wheat on rows 15–16 of the field (grid 13–22 × {15,16}).
  const tiles: Array<[number, number]> = [];
  for (const gy of [15, 16]) for (let gx = 13; gx < 23; gx++) tiles.push([gx, gy]);
  for (const [gx, gy] of tiles) await clickTile(gx, gy);
  await expect(page.getByTestId('seeds-wheat')).toContainText('0 seeds');

  // Advance through spring (spring auto-waters).
  while (!(await day.textContent())!.includes('Summer')) await endDay.click();

  // Summer: water all 20 before each day advance.
  await page.getByTestId('tool-water').click();
  while ((await day.textContent())!.includes('Summer')) {
    for (const [gx, gy] of tiles) await clickTile(gx, gy);
    await endDay.click();
  }

  // Fall day 13: harvest all 20 wheat.
  await expect(day).toContainText('Fall 1');
  await page.getByTestId('tool-harvest').click();
  for (const [gx, gy] of tiles) await clickTile(gx, gy);
  await expect(page.getByTestId('seeds-wheat')).toContainText('20 stored');

  // Day 13 → 14: the contract settles for exactly qty × locked price = 360.
  const beforeSettle = await gold();
  await endDay.click();
  await expect(page.getByTestId('hud-message')).toContainText('Contract delivered: 12 Wheat for 360 gold');
  expect(await gold()).toBe(beforeSettle + 360);
  await expect(page.getByTestId('seeds-wheat')).toContainText('8 stored');

  // Advance to winter and sell the remaining 8 wheat at the elevator.
  while (!(await day.textContent())!.includes('Winter')) await endDay.click();
  await page.getByTestId('open-market').click();
  await expect(page.getByTestId('elevator-room')).toContainText('25 bu');
  const beforeSale = await gold();
  await page.getByTestId('sell-wheat-all').click();
  const afterSale = await gold();
  expect(afterSale).toBeGreaterThan(beforeSale);
  await expect(page.getByTestId('seeds-wheat')).toContainText('0 stored');
  await expect(page.getByTestId('elevator-room')).toContainText('17 bu'); // 25 − 8

  // --- Amendment A-001: sale + contract income funds the sprinkler. ---
  await page.getByTestId('close-market').click();
  await page.getByTestId('open-shop').click();
  expect(await gold()).toBeGreaterThanOrEqual(500);
  await page.getByTestId('buy-upgrade-sprinkler').click();
  await page.getByTestId('close-shop').click();
  // Buying the sprinkler switches it on (legacy parity); verify the toggle works.
  const sprinklerToggle = page.getByTestId('toggle-sprinkler');
  await expect(sprinklerToggle).toContainText('ON');
  await sprinklerToggle.click();
  await expect(sprinklerToggle).toContainText('OFF');
  await sprinklerToggle.click();
  await expect(sprinklerToggle).toContainText('ON');

  // Year 2 spring: the field was re-tilled at winter→spring. Plant 5 corn
  // from starting inventory — growTime 9 keeps it immature (thirsty) into
  // summer, so the sprinklers have something to water.
  while (!(await day.textContent())!.includes('Spring')) await endDay.click();
  await page.getByTestId('tool-plant').click();
  await page.getByTestId('crop-select').selectOption('corn');
  for (let gx = 13; gx < 18; gx++) await clickTile(gx, 15);
  await expect(page.getByTestId('seeds-corn')).toContainText('5 seeds'); // 10 − 5 planted

  // Into year 2 summer: sprinklers water automatically and charge OpEx.
  while (!(await day.textContent())!.includes('Summer')) await endDay.click();
  // Entering summer decays soil moisture below the thirst threshold, so the
  // next tick has the sprinklers water the corn and charge per-tile OpEx.
  const beforeOpEx = await gold();
  await endDay.click();
  await expect(page.getByTestId('hud-message')).toContainText(/Sprinklers watered \d+ tiles for \d+ gold/);
  expect(await gold()).toBeLessThan(beforeOpEx);

  await page.screenshot({ path: `${PROOF_DIR}segment5-market-era.png`, fullPage: true });
  await context.tracing.stopChunk({ path: `${PROOF_DIR}segment5-market-era-trace.zip` });

  expect(pageErrors).toEqual([]);
});
