import { describe, expect, it } from 'vitest';
import type { Progress } from '@yawelo-idle/progress';
import { estimates } from './summary';

/**
 * The roadmap's two estimates (#828), from `packages/progress`'s maths, as
 * the voyage map's bar and expected season read them (#1068).
 */
const PROGRESS: Progress = {
  tickets: {
    closed: 157,
    total: 430,
    epics: 12,
    postLaunch: 4,
    notPlanned: 3,
    pace: [2, 0, 3, 4, 0, 5, 3],
  },
  effort: {
    available: true,
    closedPoints: 600,
    openPoints: 1177.4,
    openStories: 273,
    assumedClosed: 2,
    scoredMean: 3.5,
    pace: [6, 0, 9, 10, 0, 12, 4],
  },
};

describe('the two estimates', () => {
  const both = estimates(PROGRESS, '2026-11-02');

  it('gives tickets as a share closed, rounded as the close-out rounds it', () => {
    expect([
      both.tickets.percent,
      both.tickets.closed,
      both.tickets.total,
    ]).toEqual([37, 157, 430]);
  });

  it('dates the tickets ETA from their pace, with its confidence', () => {
    // 273 left at 17 in 7 days: ceil(273 × 7 ÷ 17) = 113 days.
    expect([both.tickets.eta, both.tickets.confidence]).toEqual([
      '2027-02-23',
      'medium',
    ]);
  });

  it('gives effort as whole points remaining, never a share', () => {
    expect(both.effort).toMatchObject({ available: true, pointsLeft: 1177 });
    expect(Object.keys(both.effort)).not.toContain('percent');
  });

  it('dates the effort ETA from its pace, with its confidence', () => {
    // 1177.4 left at 41 in 7 days: ceil(1177.4 × 7 ÷ 41) = 202 days.
    expect(both.effort).toMatchObject({
      eta: '2027-05-23',
      confidence: 'medium',
    });
  });

  it('says how many closed stories it assumed the mean for', () => {
    expect(both.effort).toMatchObject({ assumedClosed: 2, scoredMean: 3.5 });
  });

  it('gives no ETA when nothing closed in the window', () => {
    const still = estimates(
      {
        ...PROGRESS,
        tickets: { ...PROGRESS.tickets, pace: [0, 0, 0, 0, 0, 0, 0] },
      },
      '2026-11-02',
    );
    expect([still.tickets.eta, still.tickets.confidence]).toEqual([
      null,
      'low',
    ]);
  });

  it('says effort is unavailable, with how many are scored, until every open story is', () => {
    const unscored = estimates(
      { ...PROGRESS, effort: { available: false, scored: 200, open: 273 } },
      '2026-11-02',
    );
    expect(unscored.effort).toEqual({
      available: false,
      scored: 200,
      open: 273,
    });
  });

  it('gives no tickets share on an empty board', () => {
    const empty = estimates(
      { ...PROGRESS, tickets: { ...PROGRESS.tickets, closed: 0, total: 0 } },
      '2026-11-02',
    );
    expect(empty.tickets.percent).toBe(0);
  });
});
