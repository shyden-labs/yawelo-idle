import { expect, test, type Page } from '@playwright/test';
import type { PublicSnapshot } from '@yawelo-idle/progress';
import { COPY } from '../../apps/site/src/copy';
import { FEATURES, type Milestone } from '../../apps/site/src/roadmap/features';
import { expectedSeason } from '../../apps/site/src/roadmap/season';
import { stages, type Stage } from '../../apps/site/src/roadmap/stages';
import { estimates } from '../../apps/site/src/roadmap/summary';
import { fill, islandName } from '../../apps/site/src/roadmap/voyage';
import { press } from '../press';

/**
 * The voyage map on dev (#1068, spec §7): the deployed site Worker serving
 * the page and the real board's snapshot. Each journey reads the snapshot
 * first and expects what the page's own model makes of it, so it holds for
 * whatever the board says. Real clicks, taps and key presses only (global
 * real-tests rule); every target runs these journeys unchanged.
 */
const en = COPY.en.map;

async function snapshotOf(page: Page): Promise<PublicSnapshot> {
  const response = await page.request.get('/api/roadmap.json');
  expect(response.status(), 'the roadmap snapshot').toBe(200);
  return (await response.json()) as PublicSnapshot;
}

/** The page, loaded until its islands are drawn, and the stages it draws. */
async function openMap(
  page: Page,
): Promise<{ drawn: Stage[]; snapshot: PublicSnapshot }> {
  const snapshot = await snapshotOf(page);
  await page.goto('/roadmap');
  await expect(page.locator('button[data-island]').first()).toBeVisible();
  return { drawn: stages(snapshot.items), snapshot };
}

const islandButtons = (page: Page) => page.locator('button[data-island]');

const stateText = (stage: Stage): string =>
  stage.state === 'done'
    ? en.done
    : stage.state === 'under way'
      ? fill(en.underWay, { percent: stage.percent })
      : en.notStarted;

const label = (stage: Stage): string =>
  `${islandName(stage, COPY.en.voyage)}, ${stateText(stage)}`;

test('the map as it loads: nine islands named and stated from the snapshot, one bar, the season and its note, nothing of the old page (#1068 AC2, AC3, AC6, AC7)', async ({
  page,
}) => {
  const { drawn, snapshot } = await openMap(page);
  expect.soft(drawn, 'the board has the nine build stages').toHaveLength(9);
  const buttons = islandButtons(page);
  await expect.soft(buttons).toHaveCount(drawn.length);
  for (const [i, stage] of drawn.entries())
    // runtime population: the stages come from the live board's snapshot.
    await expect
      .soft(buttons.nth(i))
      .toHaveAttribute('aria-label', label(stage));

  const both = estimates(snapshot.progress, snapshot.readAt.slice(0, 10));
  const bar = page.locator('progress');
  await expect.soft(bar).toHaveCount(1);
  await expect.soft(bar).toHaveAttribute('value', String(both.tickets.percent));
  await expect
    .soft(page.locator('[data-bar-label]'))
    .toHaveText(fill(en.bar, { percent: both.tickets.percent }));

  const season = expectedSeason(both);
  if (season === null) {
    await expect.soft(page.locator('[data-season]')).toHaveCount(0);
    await expect.soft(page.locator('[data-season-note]')).toHaveCount(0);
  } else {
    await expect.soft(page.locator('[data-season]')).toHaveText(
      fill(season.half === 1 ? en.season1 : en.season2, {
        year: season.year,
      }),
    );
    await expect
      .soft(page.locator('[data-season-note]'))
      .toHaveText(en.seasonNote);
  }

  for (const gone of [
    COPY.en.voyage.summary.heading,
    COPY.en.voyage.summary.shipped,
    COPY.en.voyage.summary.waiting,
    COPY.en.voyage.live,
  ])
    // one scenario: each line of the old page, absent from the new one.
    await expect.soft(page.getByText(gone, { exact: true })).toHaveCount(0);
  await expect.soft(page.locator('svg[aria-hidden="true"]')).not.toHaveCount(0);
});

test('pressing islands: a panel opens with its features, closes by the island, its close button and Escape, one at a time, and at phone width the map scrolls sideways but the page does not (#1068 AC5, AC9)', async ({
  page,
  hasTouch,
}) => {
  const { drawn } = await openMap(page);
  const buttons = islandButtons(page);
  const panel = page.locator('[data-island-panel]');
  const first = drawn[0];
  if (first === undefined) throw new Error('the board has no stage');
  await expect.soft(panel).toHaveCount(0);

  await press(buttons.nth(0), hasTouch);
  await expect.soft(buttons.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect.soft(panel).toHaveCount(1);
  await expect
    .soft(panel.locator('h2'))
    .toHaveText(islandName(first, COPY.en.voyage));
  await expect
    .soft(panel.locator('li'))
    .toHaveText([...FEATURES.en[first.milestone as Milestone]]);

  await press(buttons.nth(0), hasTouch);
  await expect.soft(panel).toHaveCount(0);

  await press(buttons.nth(0), hasTouch);
  await press(buttons.nth(1), hasTouch);
  await expect.soft(buttons.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect.soft(buttons.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect.soft(panel).toHaveCount(1);

  await press(panel.locator('button[data-close]'), hasTouch);
  await expect.soft(panel).toHaveCount(0);

  await press(buttons.nth(2), hasTouch);
  await page.keyboard.press('Escape');
  await expect.soft(panel).toHaveCount(0);

  // Phone width is a step of this journey (2026-11-13): the map's box
  // scrolls sideways, the page never does.
  await page.setViewportSize({ width: 320, height: 640 });
  await page.reload();
  await expect(buttons.first()).toBeVisible();
  const box = page.locator('[data-voyage]');
  const sideways = await box.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect
    .soft(sideways, 'the map box scrolls sideways at 320 px')
    .toBeGreaterThan(0);
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect
    .soft(pageOverflow, 'the page scrolls sideways at 320 px')
    .toBeLessThanOrEqual(0);
});

test('the keyboard: Tab reaches the first island, Enter opens it, Space closes it, Escape closes another (#1068 AC5)', async ({
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
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect.soft(page.locator('[data-island-panel]')).toHaveCount(0);
});

test('draws the board the page carries with the live socket refused and the JSON never fetched, saying nothing of loading or failing (#829, #1068, #1104 AC1, AC2)', async ({
  page,
}) => {
  await page.routeWebSocket(/\/api\/roadmap\/live$/, (socket) => {
    void socket.close();
  });
  // The page draws from its own HTML (#1104): a fetch of the JSON is refused.
  // page.request (snapshotOf) is not routed, so the expected board is read.
  let fetched = 0;
  await page.route(/\/api\/roadmap\.json$/, (route) => {
    fetched += 1;
    return route.abort();
  });
  const { drawn } = await openMap(page);
  await expect.soft(islandButtons(page)).toHaveCount(drawn.length);
  await expect.soft(page.locator('[data-updated]')).toBeVisible();
  await expect.soft(page.getByRole('alert')).toHaveCount(0);
  await expect
    .soft(page.locator('body'))
    .not.toContainText('Reading the board…');
  await expect
    .soft(page.locator('body'))
    .not.toContainText('The roadmap could not be read just now.');
  expect.soft(fetched, 'fetches of /api/roadmap.json').toBe(0);
});
