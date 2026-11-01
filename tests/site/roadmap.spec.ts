import { expect, test, type Page } from '@playwright/test';
import type { BoardItem } from '@yawelo-idle/progress';
import { voyage, type Voyage } from '../../apps/site/src/roadmap/voyage';

/**
 * The voyage map on dev (#827): the deployed site Worker serving the page and
 * the real board's snapshot. Each test reads the snapshot first and expects
 * what `voyage` makes of it, so it holds for whatever the board says. Real
 * clicks and key presses only (global real-tests rule).
 */

interface Snapshot {
  items: BoardItem[];
}

async function snapshotOf(page: Page): Promise<Snapshot> {
  const response = await page.request.get('/api/roadmap.json');
  expect(response.status(), 'the roadmap snapshot').toBe(200);
  return (await response.json()) as Snapshot;
}

/** The page, loaded until its islands are drawn, and the voyage it draws. */
async function openMap(
  page: Page,
): Promise<{ map: Voyage; items: BoardItem[] }> {
  const { items } = await snapshotOf(page);
  await page.goto('/roadmap');
  await expect(page.locator('.island').first()).toBeVisible();
  return { map: voyage(items), items };
}

const islandButtons = (page: Page) =>
  page.locator('ol.islands:not(.beyond) > li.island > button');

test('draws one island per epic, in delivery order', async ({ page }) => {
  const { map } = await openMap(page);
  expect(map.islands.length).toBeGreaterThan(0);
  await expect(page.locator('ol.islands:not(.beyond) .island-name')).toHaveText(
    map.islands.map((i) => i.name),
  );
});

test('shows each island’s status', async ({ page }) => {
  const { map } = await openMap(page);
  const statuses = await page
    .locator('ol.islands:not(.beyond) > li.island')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-status')));
  expect(statuses).toEqual(map.islands.map((i) => i.status));
});

test('puts post-launch epics in Beyond launch', async ({ page }) => {
  const { map } = await openMap(page);
  await expect(page.locator('ol.beyond .island-name')).toHaveText(
    map.beyond.map((i) => i.name),
  );
});

test('marks the ship at the first island not done', async ({ page }) => {
  const { map } = await openMap(page);
  const ship = page.locator('li.island:has(.ship)');
  if (map.shipAt === null) {
    await expect(ship).toHaveCount(0);
    return;
  }
  await expect(ship).toHaveCount(1);
  await expect(ship).toHaveAttribute('data-epic', String(map.shipAt));
});

test('opens an island’s panel with a click and closes it with another', async ({
  page,
}) => {
  await openMap(page);
  const button = islandButtons(page).first();
  const panel = page.locator(
    `#${(await button.getAttribute('aria-controls')) ?? ''}`,
  );
  await expect(panel).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});

test('opens one panel at a time', async ({ page }) => {
  await openMap(page);
  const buttons = islandButtons(page);
  await buttons.nth(0).click();
  await buttons.nth(1).click();
  await expect(buttons.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(buttons.nth(1)).toHaveAttribute('aria-expanded', 'true');
});

test('opens and closes an island from the keyboard', async ({ page }) => {
  await openMap(page);
  const button = islandButtons(page).first();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('reaches the first island with Tab', async ({ page }) => {
  await openMap(page);
  const first = islandButtons(page).first();
  for (let presses = 0; presses < 50; presses += 1) {
    // one scenario: Tab until the first island has focus, at most 50 stops.
    if (await first.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(first).toBeFocused();
});

test('shows an open island’s plain words: what’s built, what’s left, the rest counted', async ({
  page,
}) => {
  const { map } = await openMap(page);
  const island = map.islands[0];
  if (island === undefined) throw new Error('the board has no island');
  await islandButtons(page).first().click();
  const panel = page.locator(`#panel-${String(island.epic)}`);
  await expect(panel.locator('ul.built a')).toHaveText(
    island.built.map((b) => b.title),
  );
  await expect(panel.locator('ul.left a')).toHaveText(
    island.left.map((l) => l.title),
  );
  await expect(panel.locator('.behind')).toHaveCount(
    island.behindTheScenes > 0 ? 1 : 0,
  );
});

test('shows no story’s raw ticket title anywhere', async ({ page }) => {
  const { items } = await openMap(page);
  const buttons = islandButtons(page);
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    // one scenario: open every island in turn, so every panel is rendered visible.
    await buttons.nth(i).click();
  }
  const text = await page.locator('body').innerText();
  const raw = items
    .filter((item) => !/^Epic\b/.test(item.title))
    .filter((item) => item.publicTitle !== item.title)
    .map((item) => item.title)
    .filter((title) => text.includes(title));
  expect(raw).toEqual([]);
});

test('fits 320 px wide with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openMap(page);
  await islandButtons(page).first().click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
