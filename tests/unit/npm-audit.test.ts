import { describe, expect, it } from 'vitest';
import { EXCEPTIONS, judgeAudit } from '../../scripts/npm-audit';

/**
 * CI's audit step (#720) fails on every advisory except one recorded here
 * with its reason and an expiry date (#873, Shyden 2026-11-05: route (c)).
 * The report shape is `npm audit --json`'s: each vulnerable package lists
 * `via`, either an advisory object or the name of the package it comes from.
 */
const GHSA = 'GHSA-gcqx-w48m-w2h4';
const report = (...advisories: { url: string; name: string }[]): unknown => ({
  vulnerabilities: {
    wrapper: { severity: 'low', via: ['inner'] },
    ...Object.fromEntries(
      advisories.map((advisory) => [
        advisory.name,
        {
          severity: 'low',
          via: [{ ...advisory, severity: 'low', title: 'a flaw' }],
        },
      ]),
    ),
  },
});
const deepmerge = {
  url: `https://github.com/advisories/${GHSA}`,
  name: 'deepmerge',
};
const exception = {
  id: GHSA,
  reason: 'build time only',
  expires: '2027-01-04',
};

describe('the audit judge', () => {
  it('passes a clean report', () => {
    expect(judgeAudit({ vulnerabilities: {} }, [], '2026-11-05')).toEqual([]);
  });

  it('refuses an advisory with no exception, naming it and its package', () => {
    expect(judgeAudit(report(deepmerge), [], '2026-11-05')).toEqual([
      `${GHSA} (low, deepmerge) has no recorded exception`,
    ]);
  });

  it('passes an advisory whose exception has not expired', () => {
    expect(judgeAudit(report(deepmerge), [exception], '2026-11-05')).toEqual(
      [],
    );
  });

  it('passes on the expiry day itself', () => {
    expect(judgeAudit(report(deepmerge), [exception], '2027-01-04')).toEqual(
      [],
    );
  });

  it('refuses the day after the exception expires', () => {
    expect(judgeAudit(report(deepmerge), [exception], '2027-01-05')).toEqual([
      `the exception for ${GHSA} expired on 2027-01-04: look again`,
    ]);
  });

  it('refuses an exception that matches no finding, so the list stays honest', () => {
    expect(
      judgeAudit({ vulnerabilities: {} }, [exception], '2026-11-05'),
    ).toEqual([`the exception for ${GHSA} matches no finding: remove it`]);
  });

  it('names an advisory once when two packages carry it, in name order', () => {
    const twice = report({ ...deepmerge, name: 'zeta' }, deepmerge);
    expect(judgeAudit(twice, [], '2026-11-05')).toEqual([
      `${GHSA} (low, deepmerge, zeta) has no recorded exception`,
    ]);
  });

  it('refuses an exception with no reason', () => {
    expect(
      judgeAudit(
        report(deepmerge),
        [{ ...exception, reason: ' ' }],
        '2026-11-05',
      ),
    ).toEqual([`the exception for ${GHSA} gives no reason`]);
  });

  it('refuses an expiry that is not a YYYY-MM-DD date', () => {
    expect(
      judgeAudit(
        report(deepmerge),
        [{ ...exception, expires: '4 Jan 2027' }],
        '2026-11-05',
      ),
    ).toEqual([`the exception for ${GHSA} has no YYYY-MM-DD expiry`]);
  });

  it('refuses a report that is not npm audit JSON', () => {
    expect(() => judgeAudit({ error: 'offline' }, [], '2026-11-05')).toThrow(
      'not an npm audit --json report',
    );
  });
});

describe('the recorded exceptions', () => {
  it('hold only the deepmerge advisory Shyden allowed on 2026-11-05', () => {
    expect(EXCEPTIONS.map((entry) => entry.id)).toEqual([GHSA]);
  });

  it('expire no later than 60 days after the ruling', () => {
    expect(EXCEPTIONS[0]?.expires).toBe('2027-01-04');
  });
});
