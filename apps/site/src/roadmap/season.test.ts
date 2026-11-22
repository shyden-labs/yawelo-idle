import { describe, expect, it } from 'vitest';
import { expectedSeason } from './season';
import type { Estimates } from './summary';

/**
 * The expected season (#1068 AC6, spec §3; Shyden, 2026-11-22): the later of
 * the two forecasts, in halves of the year, hidden with no forecast.
 */
const estimatesWith = (
  ticketsEta: string | null,
  effortEta: { eta: string | null } | 'unavailable',
): Estimates => ({
  tickets: {
    percent: 51,
    closed: 257,
    total: 507,
    eta: ticketsEta,
    confidence: 'low',
  },
  effort:
    effortEta === 'unavailable'
      ? { available: false, scored: 10, open: 250 }
      : {
          available: true,
          pointsLeft: 1110,
          eta: effortEta.eta,
          confidence: 'low',
          assumedClosed: 0,
          scoredMean: 3.8,
        },
});

describe('expectedSeason (#1068)', () => {
  it('takes the effort forecast when it is the later', () => {
    expect(
      expectedSeason(estimatesWith('2027-01-18', { eta: '2027-03-02' })),
    ).toEqual({
      half: 1,
      year: 2027,
    });
  });

  it('takes the tickets forecast when it is the later', () => {
    expect(
      expectedSeason(estimatesWith('2027-08-01', { eta: '2027-03-02' })),
    ).toEqual({
      half: 2,
      year: 2027,
    });
  });

  it.each([
    ['2027-06-30', 1],
    ['2027-07-01', 2],
    ['2027-01-01', 1],
    ['2027-12-31', 2],
  ] as const)('puts %s in half %i', (eta, half) => {
    expect(expectedSeason(estimatesWith(eta, { eta: eta }))).toEqual({
      half,
      year: 2027,
    });
  });

  it('crosses a year when the later forecast does', () => {
    expect(
      expectedSeason(estimatesWith('2027-12-20', { eta: '2028-01-05' })),
    ).toEqual({
      half: 1,
      year: 2028,
    });
  });

  it('is hidden when the tickets forecast is missing', () => {
    expect(
      expectedSeason(estimatesWith(null, { eta: '2027-03-02' })),
    ).toBeNull();
  });

  it('is hidden when the effort forecast is missing', () => {
    expect(
      expectedSeason(estimatesWith('2027-01-18', { eta: null })),
    ).toBeNull();
  });

  it('is hidden when effort is unavailable', () => {
    expect(
      expectedSeason(estimatesWith('2027-01-18', 'unavailable')),
    ).toBeNull();
  });
});
