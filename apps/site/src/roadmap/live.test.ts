import { describe, expect, it } from 'vitest';
import { liveUrl, newer } from './live';

/** The roadmap's live socket (#829): where it is, and which snapshot wins. */
describe('the live socket’s address', () => {
  it('is wss on an https page', () => {
    expect(liveUrl('https://dev.yawelo-idle.shyden.co.uk/roadmap')).toBe(
      'wss://dev.yawelo-idle.shyden.co.uk/api/roadmap/live',
    );
  });

  it('is ws on an http page', () => {
    expect(liveUrl('http://localhost:8787/id/roadmap?x=1#top')).toBe(
      'ws://localhost:8787/api/roadmap/live',
    );
  });
});

describe('which snapshot is shown', () => {
  it('takes any snapshot when none is shown yet', () => {
    expect(newer(null, { version: 1 })).toBe(true);
  });

  it('takes a later version', () => {
    expect(newer({ version: 3 }, { version: 4 })).toBe(true);
  });

  it('keeps the shown one over the same version', () => {
    expect(newer({ version: 4 }, { version: 4 })).toBe(false);
  });

  it('keeps the shown one over an earlier version', () => {
    expect(newer({ version: 4 }, { version: 3 })).toBe(false);
  });
});
