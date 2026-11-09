import { describe, expect, it, vi } from 'vitest';
import { QuotaRefused, type LedgerDeps } from '../../scripts/google-ledger';
import {
  BATCH_CHARACTERS,
  decode,
  encode,
  ENDPOINT,
  parseKeyFile,
  readBack,
  type Fetch,
} from '../../scripts/google-read-back';

/**
 * The repo's one Google Cloud Translation caller (#638 AC1). Text goes as
 * HTML with each `{slot}` kept from translation (measured in shyden.co.uk:
 * sent as plain text, Google fills a slot with invented numbers), and the
 * answer's entities are decoded. Every request is counted on the shared
 * ledger (scripts/google-ledger.ts), here in memory; Google is stood in.
 */

const KEY = 'test-key';
const LEDGER = '/ledger.json';
const PATHS = { ledger: LEDGER, lock: '/lock' };

function ledgerDeps(start = '{}'): { deps: LedgerDeps; ledger: () => string } {
  const files = new Map<string, string>([[LEDGER, start]]);
  const deps: LedgerDeps = {
    pid: 1,
    worktree: '/w',
    now: () => new Date('2026-11-09T18:00:00Z'),
    sleep: () => Promise.resolve(),
    alive: () => false,
    read: (path) => Promise.resolve(files.get(path)),
    create: () => Promise.resolve(true),
    write: (path, text) => {
      files.set(path, text);
      return Promise.resolve();
    },
    rename: (from, to) => {
      files.set(to, files.get(from) ?? '');
      files.delete(from);
      return Promise.resolve();
    },
    remove: () => Promise.resolve(),
  };
  return { deps, ledger: () => files.get(LEDGER) ?? '' };
}

/** Google answering each text with `translate(text)`, recording what it was sent. */
function google(translate: (text: string) => string = (text) => `T:${text}`) {
  const fetch = vi.fn<Fetch>((_url, init) => {
    const { q } = JSON.parse(init.body as string) as { q: string[] };
    return Promise.resolve(
      Response.json({
        data: {
          translations: q.map((text) => ({ translatedText: translate(text) })),
        },
      }),
    );
  });
  const sent = (call = 0) => {
    const [url, init] = fetch.mock.calls[call] ?? [];
    return {
      url,
      body: JSON.parse(init?.body as string) as Record<string, unknown>,
    };
  };
  return { fetch, sent };
}

describe('the key file (#638)', () => {
  it('reads the shared key', () => {
    expect(parseKeyFile('GOOGLE_TRANSLATE_API_KEY=abc123\n')).toBe('abc123');
  });

  it('refuses a file with no key, without echoing it', () => {
    expect(() => parseKeyFile('OTHER=secret\n')).toThrow(
      'google-translate.env: no GOOGLE_TRANSLATE_API_KEY line',
    );
  });

  it('refuses a key line holding only spaces', () => {
    expect(() => parseKeyFile('GOOGLE_TRANSLATE_API_KEY=   \n')).toThrow(
      'google-translate.env: no GOOGLE_TRANSLATE_API_KEY line',
    );
  });
});

describe('slots, kept from translation (#638)', () => {
  it('wraps each {slot} in a span Google leaves alone, escaping the rest', () => {
    expect(encode('Hi {name} & <you>')).toBe(
      'Hi <span translate="no">{name}</span> &amp; &lt;you&gt;',
    );
  });

  it('unwraps the spans and decodes the answer’s entities', () => {
    expect(
      decode(
        'Halo <span translate="no">{name}</span> &amp; &#39;kamu&#39; &quot;x&quot; &lt;b&gt;',
      ),
    ).toBe('Halo {name} & \'kamu\' "x" <b>');
  });

  it('decodes a numbered entity', () => {
    expect(decode('caf&#233;')).toBe('café');
  });
});

describe('a read-back (#638 AC1)', () => {
  it('posts the texts as HTML to Google with the key, source and target', async () => {
    const { fetch, sent } = google();
    const { deps } = ledgerDeps();
    await readBack(['Halo {name}'], 'id', 'en', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    expect(sent().url).toBe(`${ENDPOINT}?key=${KEY}`);
    expect(sent().body).toEqual({
      q: ['Halo <span translate="no">{name}</span>'],
      source: 'id',
      target: 'en',
      format: 'html',
    });
  });

  it('answers each text in order, decoded', async () => {
    const { fetch } = google((text) => text.replace('Halo', 'Hello'));
    const { deps } = ledgerDeps();
    expect(
      await readBack(['Halo {name}', 'Halo &'], 'id', 'en', {
        key: KEY,
        fetch,
        paths: PATHS,
        deps,
      }),
    ).toEqual(['Hello {name}', 'Hello &']);
  });

  it('counts the characters it sent on the ledger', async () => {
    const { fetch } = google();
    const { deps, ledger } = ledgerDeps();
    await readBack(['ab', 'c&'], 'id', 'en', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    // 'ab' and 'c&amp;' as sent: 2 + 6.
    expect(JSON.parse(ledger())).toEqual({ '2026-11-09': 8 });
  });

  it('sends texts together up to the batch size, then starts another request', async () => {
    const { fetch, sent } = google();
    const { deps } = ledgerDeps();
    const big = 'a'.repeat(BATCH_CHARACTERS - 1);
    await readBack([big, 'bb', 'c'], 'id', 'en', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sent(0).body['q']).toEqual([big]);
    expect(sent(1).body['q']).toEqual(['bb', 'c']);
    expect(BATCH_CHARACTERS).toBe(5_000);
  });

  it('sends texts filling a batch exactly in one request', async () => {
    const { fetch, sent } = google();
    const { deps } = ledgerDeps();
    const most = 'a'.repeat(BATCH_CHARACTERS - 1);
    await readBack([most, 'b'], 'id', 'en', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(sent(0).body['q']).toEqual([most, 'b']);
  });

  it('sends a text longer than a batch alone', async () => {
    const { fetch, sent } = google();
    const { deps } = ledgerDeps();
    const huge = 'a'.repeat(BATCH_CHARACTERS + 1);
    await readBack(['x', huge], 'id', 'en', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    expect(sent(0).body['q']).toEqual(['x']);
    expect(sent(1).body['q']).toEqual([huge]);
  });

  it('reads Google’s 403 for a rate limit as the day spent', async () => {
    const fetch = vi.fn<Fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: { code: 403, message: 'User Rate Limit Exceeded' } },
          { status: 403 },
        ),
      ),
    );
    const { deps, ledger } = ledgerDeps();
    await expect(
      readBack(['a'], 'id', 'en', { key: KEY, fetch, paths: PATHS, deps }),
    ).rejects.toThrow(QuotaRefused);
    expect(JSON.parse(ledger())).toEqual({ '2026-11-09': 16_000 });
  });

  it('reads a 403 that is not a rate limit as a failure, counting only what it sent', async () => {
    const fetch = vi.fn<Fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: { code: 403, message: 'API key not valid' } },
          { status: 403 },
        ),
      ),
    );
    const { deps, ledger } = ledgerDeps();
    const failure = readBack(['a'], 'id', 'en', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    await expect(failure).rejects.toThrow(
      'Google read-back: 403 API key not valid',
    );
    await expect(failure).rejects.not.toBeInstanceOf(QuotaRefused);
    expect(JSON.parse(ledger())).toEqual({ '2026-11-09': 1 });
  });

  it('names any other refusal by status and message, without the key', async () => {
    const fetch = vi.fn<Fetch>(() =>
      Promise.resolve(
        Response.json({ error: { message: 'Bad language' } }, { status: 400 }),
      ),
    );
    const { deps } = ledgerDeps();
    const failure = readBack(['a'], 'id', 'xx', {
      key: KEY,
      fetch,
      paths: PATHS,
      deps,
    });
    await expect(failure).rejects.toThrow('Google read-back: 400 Bad language');
    await expect(failure).rejects.not.toThrow(KEY);
  });

  it('refuses an answer with the wrong number of texts', async () => {
    const fetch = vi.fn<Fetch>(() =>
      Promise.resolve(Response.json({ data: { translations: [] } })),
    );
    const { deps } = ledgerDeps();
    await expect(
      readBack(['a'], 'id', 'en', { key: KEY, fetch, paths: PATHS, deps }),
    ).rejects.toThrow('Google read-back: 0 texts answered for 1 sent');
  });
});
