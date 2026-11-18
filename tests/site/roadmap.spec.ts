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

test('the map as it loads: the served fields, the islands, the ship, the totals, the shipped stories, live over the socket (#827, #828, #829, #840)', async ({
  page,
}) => {
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
  const { map, items } = await openMap(page);

  // One island per epic, in delivery order.
  expect.soft(map.islands.length).toBeGreaterThan(0);
  await expect
    .soft(page.locator('ol.islands .island-name'))
    .toHaveText(map.islands.map((i) => islandName(i, COPY.en.voyage)));

  // Each island's status.
  const statuses = await page
    .locator('ol.islands > li.island')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-status')));
  expect.soft(statuses).toEqual(map.islands.map((i) => i.status));

  // Only the fields the public page shows.
  const response = await page.request.get('/api/roadmap.json');
  const served = (await response.json()) as Record<string, unknown> & {
    items: Record<string, unknown>[];
  };
  const keys = new Set(served.items.map((i) => Object.keys(i).sort().join()));
  expect
    .soft([Object.keys(served).sort(), [...keys]])
    .toEqual([
      ['items', 'progress', 'readAt', 'version'],
      [
        'closedAt,epic,estimate,milestone,number,parent,publicSummary,publicTitle,state,waiting',
      ],
    ]);

  // One list of islands, nothing after launch.
  await expect.soft(page.locator('ol.islands')).toHaveCount(1);

  // The ship at the first island not done.
  const ship = page.locator('li.island:has(.ship)');
  if (map.shipAt === null) {
    await expect.soft(ship).toHaveCount(0);
  } else {
    await expect.soft(ship).toHaveCount(1);
    await expect.soft(ship).toHaveAttribute('data-epic', String(map.shipAt));
  }

  // What's left totals as the islands do.
  const { total } = whatsLeft(map);
  await expect
    .soft(page.locator('.whats-left tfoot td'))
    .toHaveText([String(total.tickets), String(total.points)]);

  // The stories shipped most recently.
  await expect
    .soft(page.locator('ul.shipped a'))
    .toHaveText(recentlyShipped(items).map((s) => s.title));

  // Live over the Worker's socket; a failure names what the socket saw.
  try {
    await expect(page.locator('.live-state')).toHaveText(COPY.en.voyage.live);
  } catch (error) {
    throw new Error(`not live; the socket saw: ${seen.join(' | ')}`, {
      cause: error,
    });
  }
});

test('pressing islands: a panel opens with its plain words, closes, and only one is open at a time', async ({
  page,
  hasTouch,
}) => {
  const { map } = await openMap(page);
  const island = map.islands[0];
  if (island === undefined) throw new Error('the board has no island');
  const buttons = islandButtons(page);
  const button = buttons.first();
  const panel = page.locator(
    `#${(await button.getAttribute('aria-controls')) ?? ''}`,
  );
  await expect.soft(panel).toBeHidden();

  await press(button, hasTouch);
  await expect.soft(button).toHaveAttribute('aria-expanded', 'true');
  await expect.soft(panel).toBeVisible();

  // An open island's plain words: what's built, what's left, the rest counted.
  const words = page.locator(`#panel-${String(island.epic)}`);
  await expect
    .soft(words.locator('ul.built a'))
    .toHaveText(island.built.map((b) => b.title));
  await expect
    .soft(words.locator('ul.left a'))
    .toHaveText(island.left.map((l) => l.title));
  await expect
    .soft(words.locator('.behind'))
    .toHaveCount(island.behindTheScenes > 0 ? 1 : 0);

  await press(button, hasTouch);
  await expect.soft(button).toHaveAttribute('aria-expanded', 'false');
  await expect.soft(panel).toBeHidden();

  // One panel at a time.
  await press(buttons.nth(0), hasTouch);
  await press(buttons.nth(1), hasTouch);
  await expect.soft(buttons.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect.soft(buttons.nth(1)).toHaveAttribute('aria-expanded', 'true');

  // At 320 px wide, with an island open, nothing scrolls sideways. The width
  // is a step of this journey, not a journey of its own (2026-11-13).
  await page.setViewportSize({ width: 320, height: 640 });
  await page.reload();
  await expect(page.locator('.island').first()).toBeVisible();
  await press(buttons.first(), hasTouch);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect.soft(overflow, 'horizontal scroll at 320 px').toBeLessThanOrEqual(0);
});

test('the keyboard: Tab reaches the first island, Enter opens it, Space closes it', async ({
  page,
}) => {
  await openMap(page);
  const first = islandButtons(page).first();
  for (let presses = 0; presses < 50; presses += 1) {
    // one scenario: Tab until the first island has focus, at most 50 stops.
    if (await first.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.soft(first).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect.soft(first).toHaveAttribute('aria-expanded', 'false');
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
