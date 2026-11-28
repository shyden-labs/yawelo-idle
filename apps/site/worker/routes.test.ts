import { describe, expect, it } from 'vitest';
import {
  doorTo as siteDoorTo,
  isPrivatePath,
  PRIVATE_PATHS,
  servesPrivate,
  UNREADABLE,
} from './routes';

describe('servesPrivate (#846, #589)', () => {
  it('keeps the health report and private docs off the production host', () => {
    expect(servesPrivate('yaweloidle.com')).toBe(false);
  });

  it('keeps it off the production host in any case', () => {
    expect(servesPrivate('YAWELOIDLE.com')).toBe(false);
  });

  it('serves it on dev, behind the password', () => {
    expect(
      servesPrivate('yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev'),
    ).toBe(true);
  });
});

describe('isPrivatePath (#589)', () => {
  it('names the private docs page', () => {
    expect(isPrivatePath(PRIVATE_PATHS.docs)).toBe(true);
  });

  it('names the private spec', () => {
    expect(isPrivatePath(PRIVATE_PATHS.spec)).toBe(true);
  });

  it('names any other path under /api/private/', () => {
    expect(isPrivatePath('/api/private/anything.html')).toBe(true);
  });

  it('names /api/private itself', () => {
    expect(isPrivatePath('/api/private')).toBe(true);
  });

  it('names a percent-encoded spelling of the path', () => {
    expect(isPrivatePath('/api/%70rivate/docs')).toBe(true);
  });

  it('names an encoded slash inside the path', () => {
    expect(isPrivatePath('/api/private%2Fdocs')).toBe(true);
  });

  it('names the path in any case', () => {
    expect(isPrivatePath('/API/Private/docs')).toBe(true);
  });

  it('names the path behind doubled slashes', () => {
    expect(isPrivatePath('//api//private/docs')).toBe(true);
  });

  it('names a path whose encoding is broken, refusing it rather than guessing', () => {
    expect(isPrivatePath('/api/private%E0%A4%A')).toBe(true);
  });

  it('names an encoded path whose encoding is broken elsewhere', () => {
    expect(isPrivatePath('/api/%70rivate/%')).toBe(true);
  });

  it('leaves the public docs page alone', () => {
    expect(isPrivatePath('/api/docs')).toBe(false);
  });

  it('leaves a path that only starts with the same letters alone', () => {
    expect(isPrivatePath('/api/privateer')).toBe(false);
  });
});

describe('UNREADABLE (#846)', () => {
  it('is a fixed plain sentence, naming nothing internal', () => {
    expect(UNREADABLE).toBe('The roadmap could not be read just now.');
  });
});

/** Every door the site names must exist (#784): a missing one fails loudly. */
describe('doorTo (#784)', () => {
  it('names the door that reaches a Worker', () => {
    expect(siteDoorTo('yawelo-idle-site-dev')).toBe('dev.yaweloidle.com');
  });

  it('refuses a Worker no door reaches, naming it', () => {
    expect(() => siteDoorTo('yawelo-idle-nobody')).toThrow(
      'no door reaches yawelo-idle-nobody',
    );
  });
});
