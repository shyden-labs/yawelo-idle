import { describe, expect, it } from 'vitest';
import { MAX_HOOK_BYTES, readUpToCap } from './body';

const CHUNK_BYTES = 65_536;

/**
 * A stream that pulls only when read (highWaterMark 0), so `pulls` counts
 * exactly the chunks the reader asked for, and `cancelled` says whether the
 * reader let it go.
 */
function counted(chunks: (pull: number) => Uint8Array | null) {
  const seen = { pulls: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks(seen.pulls);
        seen.pulls += 1;
        if (chunk === null) controller.close();
        else controller.enqueue(chunk);
      },
      cancel() {
        seen.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, seen };
}

const filled = (length: number, byte: number) =>
  new Uint8Array(length).fill(byte);

describe('readUpToCap (#1107)', () => {
  it('answers 413 to a body four times the cap with no declared length, cancels it, and reads nothing past the chunk that passes the cap', async () => {
    // Bounded so a reader that reads whole fails by name here, not by memory.
    const chunks = (4 * MAX_HOOK_BYTES) / CHUNK_BYTES;
    const { stream, seen } = counted((pull) =>
      pull < chunks ? filled(CHUNK_BYTES, 1) : null,
    );
    expect(await readUpToCap(stream)).toBe(413);
    // 16 chunks fill the cap exactly; the 17th passes it.
    expect(seen.pulls).toBe(MAX_HOOK_BYTES / CHUNK_BYTES + 1);
    expect(seen.cancelled).toBe(true);
  });

  it('answers 413 to a finite body one byte over the cap', async () => {
    const { stream, seen } = counted((pull) =>
      pull === 0 ? filled(MAX_HOOK_BYTES + 1, 2) : null,
    );
    expect(await readUpToCap(stream)).toBe(413);
    expect(seen.cancelled).toBe(true);
  });

  it('returns a body of exactly the cap whole', async () => {
    const { stream, seen } = counted((pull) =>
      pull < MAX_HOOK_BYTES / CHUNK_BYTES ? filled(CHUNK_BYTES, 3) : null,
    );
    const body = await readUpToCap(stream);
    expect(body).toEqual(filled(MAX_HOOK_BYTES, 3).buffer);
    expect(seen.cancelled).toBe(false);
  });

  it('returns a small body in order, across chunks', async () => {
    const parts = [
      new TextEncoder().encode('{"a":'),
      new TextEncoder().encode('1}'),
    ];
    const { stream } = counted((pull) => parts[pull] ?? null);
    const body = await readUpToCap(stream);
    expect(body).not.toBe(413);
    expect(new TextDecoder().decode(body as ArrayBuffer)).toBe('{"a":1}');
  });

  it('returns an empty buffer for an empty body', async () => {
    const { stream } = counted(() => null);
    const body = await readUpToCap(stream);
    expect((body as ArrayBuffer).byteLength).toBe(0);
  });
});
