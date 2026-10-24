import { describe, expect, it } from 'vitest';
import { HOLDING_HOST, showsHolding } from './routes.ts';

/**
 * Which pages a host shows (#673): the dev front door shows the holding page
 * production shows, and the site Worker's own address keeps the site being
 * built. Names are judged exactly, never by prefix or suffix.
 */
describe('showsHolding (#673)', () => {
  it('names the dev front door', () => {
    expect(HOLDING_HOST).toBe('dev.yawelo-idle.shyden.co.uk');
  });

  it('shows the holding page on the dev front door', () => {
    expect(showsHolding('dev.yawelo-idle.shyden.co.uk')).toBe(true);
  });

  it('shows the site on the site Worker’s own workers.dev address', () => {
    expect(
      showsHolding('yawelo-idle-site-dev.shyden-labs-dev.workers.dev'),
    ).toBe(false);
  });

  it('shows the site on the dev API host', () => {
    expect(showsHolding('dev-api.yawelo-idle.shyden.co.uk')).toBe(false);
  });

  it('shows the site on a host that only starts with the front door', () => {
    expect(showsHolding('dev.yawelo-idle.shyden.co.uk.evil.example')).toBe(
      false,
    );
  });

  it('shows the site on a host that only ends with the front door', () => {
    expect(showsHolding('evil-dev.yawelo-idle.shyden.co.uk')).toBe(false);
  });
});
