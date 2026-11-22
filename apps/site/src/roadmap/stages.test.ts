import { describe, expect, it } from 'vitest';
import type { PublicItem } from '@yawelo-idle/progress';
import { stages } from './stages';

/**
 * The voyage map's stages (#1068 AC2, spec §3): one per epic with a
 * milestone 0–8, in milestone order, each from the closed share of its own
 * stories.
 */
const item = (over: Partial<PublicItem> & { number: number }): PublicItem => ({
  epic: false,
  milestone: null,
  state: 'OPEN',
  closedAt: null,
  estimate: null,
  parent: null,
  publicTitle: null,
  publicSummary: null,
  waiting: false,
  ...over,
});
const epic = (
  number: number,
  milestone: number | null,
  title: string | null = null,
) => item({ number, epic: true, milestone, publicTitle: title });
const story = (number: number, parent: number, closed: boolean) =>
  item({ number, parent, state: closed ? 'CLOSED' : 'OPEN' });

describe('stages (#1068)', () => {
  it('gives one stage per epic with a milestone, in milestone order', () => {
    const result = stages([epic(9, 2), epic(5, 0), epic(7, 1)]);
    expect(result.map((s) => [s.epic, s.milestone])).toEqual([
      [5, 0],
      [7, 1],
      [9, 2],
    ]);
  });

  it('leaves out an epic with no milestone', () => {
    expect(stages([epic(5, 0), epic(331, null)]).map((s) => s.epic)).toEqual([
      5,
    ]);
  });

  it.each([-1, 9, 1.5])(
    'leaves out an epic whose milestone is %s',
    (milestone) => {
      expect(stages([epic(5, milestone)])).toEqual([]);
    },
  );

  it('counts only the epic’s own stories, never another epic’s or a child epic', () => {
    const [stage] = stages([
      epic(5, 0),
      epic(6, 1),
      story(100, 5, true),
      story(101, 5, false),
      story(102, 6, true),
      item({ number: 103, epic: true, parent: 5, state: 'CLOSED' }),
    ]);
    expect(stage).toMatchObject({ closed: 1, total: 2 });
  });

  it('is done when every story is closed', () => {
    const [stage] = stages([
      epic(5, 0),
      story(100, 5, true),
      story(101, 5, true),
    ]);
    expect(stage).toMatchObject({ state: 'done', percent: 100 });
  });

  it('is under way when some stories are closed, the percent rounded down', () => {
    const items = [epic(5, 0)];
    for (let n = 0; n < 250; n += 1) items.push(story(1000 + n, 5, n < 249));
    const [stage] = stages(items);
    expect(stage).toMatchObject({
      state: 'under way',
      closed: 249,
      total: 250,
      percent: 99,
    });
  });

  it('is not started when no story is closed', () => {
    const [stage] = stages([epic(5, 0), story(100, 5, false)]);
    expect(stage).toMatchObject({ state: 'not started', percent: 0 });
  });

  it('is not started, 0%, with no stories at all', () => {
    const [stage] = stages([epic(5, 0)]);
    expect(stage).toMatchObject({
      state: 'not started',
      closed: 0,
      total: 0,
      percent: 0,
    });
  });

  it('ignores the epic’s own open or closed state', () => {
    const closedEpic = item({
      number: 5,
      epic: true,
      milestone: 0,
      state: 'CLOSED',
    });
    const [stage] = stages([closedEpic, story(100, 5, false)]);
    expect(stage?.state).toBe('not started');
  });

  it('carries the epic’s Public title, or null when it has none', () => {
    const result = stages([epic(5, 0, 'Shipyard'), epic(6, 1)]);
    expect(result.map((s) => s.name)).toEqual(['Shipyard', null]);
  });
});
