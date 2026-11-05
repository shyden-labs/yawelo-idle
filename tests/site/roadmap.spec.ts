import { expect, test, type Page } from '@playwright/test';
import type { PublicItem } from '@yawelo-idle/progress';
import { COPY } from '../../apps/site/src/copy';
import {
  recentlyShipped,
  whatsLeft,
} from '../../apps/site/src/roadmap/summary';
import {
  islandName,
  voyage,
  type Voyage,
} from '../../apps/site/src/roadmap/voyage';
import { press } from '../press';

/**
 * The voyage map on dev (#827): the deployed site Worker serving the page and
 * the real board's snapshot. Each test reads the snapshot first and expects
 * what `voyage` makes of it, so it holds for whatever the board says. Real
 * clicks and key presses only (global real-tests rule).
 */

interface Snapshot {
  items: PublicItem[];
}

async function snapshotOf(page: Page): Promise<Snapshot> {
  const response = await page.request.get('/api/roadmap.json');
  expect(response.status(), 'the roadmap snapshot').toBe(200);
  return (await response.json()) as Snapshot;
}

/** The page, loaded until its islands are drawn, and the voyage it draws. */
async function openMap(
  page: Page,
): Promise<{ map: Voyage; items: PublicItem[] }> {
  const { items } = await snapshotOf(page);
  await page.goto('/roadmap');
  await expect(page.locator('.island').first()).toBeVisible();
  return { map: voyage(items), items };
}

const islandButtons = (page: Page) =>
  page.locator('ol.islands > li.island > button');

test('draws one island per epic, in delivery order', async ({ page }) => {
  const { map } = await openMap(page);
  expect(map.islands.length).toBeGreaterThan(0);
  await expect(page.locator('ol.islands .island-name')).toHaveText(
    map.islands.map((i) => islandName(i, COPY.en.voyage)),
  );
});

test('shows each island’s status', async ({ page }) => {
  const { map } = await openMap(page);
  const statuses = await page
    .locator('ol.islands > li.island')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-status')));
  expect(statuses).toEqual(map.islands.map((i) => i.status));
});

test('serves only the fields the public page shows (#840)', async ({
  page,
}) => {
  const response = await page.request.get('/api/roadmap.json');
  const served = (await response.json()) as Record<string, unknown> & {
    items: Record<string, unknown>[];
  };
  const keys = new Set(served.items.map((i) => Object.keys(i).sort().join()));
  expect([Object.keys(served).sort(), [...keys]]).toEqual([
    ['items', 'progress', 'readAt', 'version'],
    [
      'closedAt,epic,estimate,milestone,number,parent,publicSummary,publicTitle,state,waiting',
    ],
  ]);
});

test('draws one list of islands, nothing after launch', async ({ page }) => {
  await openMap(page);
  await expect(page.locator('ol.islands')).toHaveCount(1);
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

test('opens an island’s panel with a press and closes it with another', async ({
  page,
  hasTouch,
}) => {
  await openMap(page);
  const button = islandButtons(page).first();
  const panel = page.locator(
    `#${(await button.getAttribute('aria-controls')) ?? ''}`,
  );
  await expect(panel).toBeHidden();
  await press(button, hasTouch);
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await press(button, hasTouch);
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});

test('opens one panel at a time', async ({ page, hasTouch }) => {
  await openMap(page);
  const buttons = islandButtons(page);
  await press(buttons.nth(0), hasTouch);
  await press(buttons.nth(1), hasTouch);
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
  hasTouch,
}) => {
  const { map } = await openMap(page);
  const island = map.islands[0];
  if (island === undefined) throw new Error('the board has no island');
  await press(islandButtons(page).first(), hasTouch);
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

test('fits 320 px wide with no horizontal scroll', async ({
  page,
  hasTouch,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openMap(page);
  await press(islandButtons(page).first(), hasTouch);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('totals what’s left as the islands do (#828)', async ({ page }) => {
  const { map } = await openMap(page);
  const { total } = whatsLeft(map);
  await expect(page.locator('.whats-left tfoot td')).toHaveText([
    String(total.tickets),
    String(total.points),
  ]);
});

test('lists the stories shipped most recently (#828)', async ({ page }) => {
  const { items } = await openMap(page);
  const shipped = recentlyShipped(items);
  await expect(page.locator('ul.shipped a')).toHaveText(
    shipped.map((s) => s.title),
  );
});

test('goes live over the Worker’s socket (#829)', async ({ page }) => {
  // What the socket did, named when the page does not go live: WebKit on
  // Linux stayed "not live" on dev where Chromium and Firefox went live.
  const seen: string[] = [];
  page.on('websocket', (socket) => {
    seen.push(`open ${socket.url()}`);
    socket.on('framereceived', () => seen.push('frame'));
    socket.on('socketerror', (error) => seen.push(`error ${error}`));
    socket.on('close', () => seen.push('close'));
  });
  page.on('console', (message) => {
    if (message.type() === 'error') seen.push(`console ${message.text()}`);
  });
  await openMap(page);
  try {
    await expect(page.locator('.live-state')).toHaveText(COPY.en.voyage.live);
  } catch (error) {
    throw new Error(`not live; the socket saw: ${seen.join(' | ')}`, {
      cause: error,
    });
  }
});

test('says it is not live when the socket is refused, keeping the snapshot read (#829)', async ({
  page,
}) => {
  await page.routeWebSocket(/\/api\/roadmap\/live$/, (socket) => {
    void socket.close();
  });
  const { map } = await openMap(page);
  await expect(page.locator('.live-state')).toHaveText(COPY.en.voyage.notLive);
  await expect(islandButtons(page)).toHaveCount(map.islands.length);
});
