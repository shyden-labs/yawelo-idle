/**
 * The repo's one Google Cloud Translation caller (#638 AC1; the guard
 * tests/guards/google-callers.test.ts refuses any other). Every translation is
 * read back by Google before it is shown or committed (global rule,
 * 2026-10-07), through the one shared free-tier key in
 * `~/.config/shyden/google-translate.env`, under the machine-wide lock and
 * ledger (./google-ledger.ts).
 *
 * Text is sent as HTML with each `{slot}` in `<span translate="no">`: sent as
 * plain text, Google fills a slot with invented numbers (measured in
 * shyden.co.uk, global rule). The answer's entities are decoded.
 *
 * Usage: `node scripts/google-read-back.ts <source> <target> < texts.json`,
 * where texts.json is a JSON array of strings; prints the read-back as a JSON
 * array in the same order.
 */
import { readFileSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  counted,
  QuotaRefused,
  withLock,
  type LedgerDeps,
  type LedgerPaths,
} from './google-ledger.ts';

export const ENDPOINT =
  'https://translation.googleapis.com/language/translate/v2';

/**
 * Characters per request at most, so one request never overshoots the day
 * by much (Google refuses only the request after the one crossing it).
 */
export const BATCH_CHARACTERS = 5_000;

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ReadBackDeps {
  readonly key: string;
  readonly fetch: Fetch;
  readonly paths: LedgerPaths;
  readonly deps: LedgerDeps;
}

/** The key from the shared env file; refuses, without echoing, if absent. */
export function parseKeyFile(text: string): string {
  const line = /^GOOGLE_TRANSLATE_API_KEY=(.+)$/m.exec(text);
  const key = line?.[1]?.trim();
  if (key === undefined || key === '')
    throw new Error('google-translate.env: no GOOGLE_TRANSLATE_API_KEY line');
  return key;
}

const escape = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** The text as HTML, each `{slot}` kept from translation. */
export function encode(text: string): string {
  return escape(text).replaceAll(
    /\{[^{}]*\}/g,
    (slot) => `<span translate="no">${slot}</span>`,
  );
}

const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Google's HTML answer as plain text: spans unwrapped, entities decoded. */
export function decode(html: string): string {
  return html
    .replaceAll(/<span translate="no">([^<]*)<\/span>/g, '$1')
    .replaceAll(/&(#\d+|[a-z]+);/g, (whole, name: string) => {
      if (name.startsWith('#'))
        return String.fromCodePoint(Number(name.slice(1)));
      return NAMED[name] ?? whole;
    });
}

/** The encoded texts in requests of at most BATCH_CHARACTERS, in order. */
function batches(encoded: readonly string[]): string[][] {
  const out: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const text of encoded) {
    if (current.length > 0 && size + text.length > BATCH_CHARACTERS) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length;
  }
  if (current.length > 0) out.push(current);
  return out;
}

async function send(
  q: readonly string[],
  source: string,
  target: string,
  { key, fetch }: ReadBackDeps,
): Promise<string[]> {
  const response = await fetch(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q, source, target, format: 'html' }),
  });
  const body = (await response.json()) as {
    data?: { translations?: { translatedText: string }[] };
    error?: { message?: string };
  };
  if (!response.ok) {
    const message = body.error?.message ?? '';
    if (response.status === 403 && /limit/i.test(message))
      throw new QuotaRefused(`Google read-back: 403 ${message}`);
    throw new Error(`Google read-back: ${String(response.status)} ${message}`);
  }
  const answered = body.data?.translations ?? [];
  if (answered.length !== q.length)
    throw new Error(
      `Google read-back: ${String(answered.length)} texts answered for ${String(q.length)} sent`,
    );
  return answered.map(({ translatedText }) => decode(translatedText));
}

/**
 * Each text read back from `source` into `target`, in order. Every request is
 * counted on the shared ledger; the caller holds the lock (`withLock`).
 */
export async function readBack(
  texts: readonly string[],
  source: string,
  target: string,
  readBackDeps: ReadBackDeps,
): Promise<string[]> {
  const out: string[] = [];
  for (const q of batches(texts.map(encode))) {
    const characters = q.reduce((sum, text) => sum + text.length, 0);
    out.push(
      ...(await counted(readBackDeps.paths, readBackDeps.deps, characters, () =>
        send(q, source, target, readBackDeps),
      )),
    );
  }
  return out;
}

const SHARED = join(homedir(), '.config', 'shyden');

/** Where every project on this machine keeps the ledger and lock. */
export const MACHINE_PATHS: LedgerPaths = {
  ledger: join(SHARED, 'google-translate-ledger.json'),
  lock: join(SHARED, 'google-translate.lock'),
};

const isCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

/**
 * The real files, clock and process table. The lock holder is named by
 * `worktree`, by default the directory this runs from.
 */
export function machineDeps(worktree: string = process.cwd()): LedgerDeps {
  return {
    pid: process.pid,
    worktree,
    now: () => new Date(),
    sleep: async (ms) => {
      await sleep(ms);
    },
    alive: (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        // EPERM: it runs, as another user.
        return isCode(error, 'EPERM');
      }
    },
    read: async (path) => {
      try {
        return await readFile(path, 'utf8');
      } catch (error) {
        if (isCode(error, 'ENOENT')) return undefined;
        throw error;
      }
    },
    create: async (path, text) => {
      try {
        await writeFile(path, text, { flag: 'wx' });
        return true;
      } catch (error) {
        if (isCode(error, 'EEXIST')) return false;
        throw error;
      }
    },
    write: (path, text) => writeFile(path, text),
    rename: (from, to) => rename(from, to),
    remove: (path) => rm(path, { force: true }),
  };
}

if (import.meta.main) {
  const [source, target] = process.argv.slice(2);
  if (source === undefined || target === undefined)
    throw new Error(
      'usage: google-read-back.ts <source> <target> < texts.json',
    );
  const texts = JSON.parse(readFileSync(0, 'utf8')) as unknown;
  if (!Array.isArray(texts) || !texts.every((t) => typeof t === 'string'))
    throw new Error('google-read-back: stdin is not a JSON array of strings');
  const key = parseKeyFile(
    await readFile(join(SHARED, 'google-translate.env'), 'utf8'),
  );
  const deps = machineDeps();
  const answer = await withLock(MACHINE_PATHS, deps, () =>
    readBack(texts, source, target, {
      key,
      fetch: (url, init) => fetch(url, init),
      paths: MACHINE_PATHS,
      deps,
    }),
  );
  process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
}
