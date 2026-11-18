import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * #958 AC2, AC3: the lock appears with its full content at once. It is
 * written to a private temporary file, then linked into place; the link
 * fails on an existing lock, so no reader ever sees an empty lock.
 */
const fs = vi.hoisted(() => ({
  writeFile: vi.fn(),
  link: vi.fn(),
  rm: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
}));
vi.mock('node:fs/promises', () => fs);

const { machineDeps } = await import('../../scripts/google-read-back');

const LOCK = '/ledger/google-translate.lock';
const code = (name: string) => Object.assign(new Error(name), { code: name });

beforeEach(() => {
  vi.resetAllMocks();
  fs.writeFile.mockResolvedValue(undefined);
  fs.link.mockResolvedValue(undefined);
  fs.rm.mockResolvedValue(undefined);
});

describe('taking the lock (#958)', () => {
  it('writes the holder to a private file beside the lock, never to the lock itself', async () => {
    await machineDeps('/w').create(LOCK, '{"pid":1}');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [path, text, options] = fs.writeFile.mock.calls[0] as [
      string,
      string,
      { flag: string },
    ];
    expect(path).not.toBe(LOCK);
    expect(path.startsWith(`${LOCK}.`)).toBe(true);
    expect(text).toBe('{"pid":1}');
    expect(options.flag).toBe('wx');
  });

  it('links the written file into place and answers that it holds the lock', async () => {
    expect(await machineDeps('/w').create(LOCK, 'x')).toBe(true);
    const written = (fs.writeFile.mock.calls[0] as [string])[0];
    expect(fs.link).toHaveBeenCalledWith(written, LOCK);
  });

  it('gives each attempt its own private file, so two in one process do not collide', async () => {
    const deps = machineDeps('/w');
    await Promise.all([deps.create(LOCK, 'a'), deps.create(LOCK, 'b')]);
    const [first, second] = fs.writeFile.mock.calls.map(
      (call) => (call as [string])[0],
    );
    expect(first).not.toBe(second);
  });

  it('removes the private file once the lock is taken', async () => {
    await machineDeps('/w').create(LOCK, 'x');
    const written = (fs.writeFile.mock.calls[0] as [string])[0];
    expect(fs.rm).toHaveBeenCalledWith(written, { force: true });
  });

  it('answers that another holds the lock when it exists, removing the private file', async () => {
    fs.link.mockRejectedValue(code('EEXIST'));
    expect(await machineDeps('/w').create(LOCK, 'x')).toBe(false);
    const written = (fs.writeFile.mock.calls[0] as [string])[0];
    expect(fs.rm).toHaveBeenCalledWith(written, { force: true });
  });

  it('throws any other failure to link, removing the private file', async () => {
    fs.link.mockRejectedValue(code('EACCES'));
    await expect(machineDeps('/w').create(LOCK, 'x')).rejects.toThrow('EACCES');
    const written = (fs.writeFile.mock.calls[0] as [string])[0];
    expect(fs.rm).toHaveBeenCalledWith(written, { force: true });
  });
});
