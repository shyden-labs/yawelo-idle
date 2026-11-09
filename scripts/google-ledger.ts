/**
 * The shared Google Cloud Translation ledger and lock (#638), kept the same
 * way by every project on this machine (global rule, 2026-10-07; quota
 * measured 2026-10-15, shyden.co.uk#754): one free-tier key, at most
 * 16,000 characters per Google day (midnight Pacific), counted in
 * `~/.config/shyden/google-translate-ledger.json` as `{"YYYY-MM-DD": chars}`.
 * Google's quota refuses the request AFTER the one that crosses the limit, so
 * the ledger, not Google, is what keeps a day under it.
 *
 * One read-back runs at a time machine-wide, under
 * `~/.config/shyden/google-translate.lock`. The ledger is read again before
 * and after every request, since a client elsewhere may write it meanwhile,
 * and is written atomically through `<ledger>.<pid>.tmp`.
 *
 * Every effect (files, clock, process table) comes in through `LedgerDeps`,
 * so the rules are unit-tested; scripts/google-read-back.ts passes the real
 * ones.
 */

/** Google's free tier per day, kept below by the ledger, not by Google. */
export const DAILY_CHARACTERS = 16_000;

/** How long a run waits for another run's lock before giving up. */
export const LOCK_CEILING_MS = 600_000;

const LOCK_STEP_MS = 1_000;

/** Characters per Google day, and any recorded raise as `"<day> limit"`. */
export type Ledger = Readonly<Record<string, number>>;

export interface LedgerPaths {
  readonly ledger: string;
  readonly lock: string;
}

export interface LedgerDeps {
  pid: number;
  worktree: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** Whether a process with this pid still runs (`kill -0`). */
  alive: (pid: number) => boolean;
  /** The file's text, or undefined when it does not exist. */
  read: (path: string) => Promise<string | undefined>;
  /** Creates the file only if it does not exist (flag `wx`); false if it did. */
  create: (path: string, text: string) => Promise<boolean>;
  write: (path: string, text: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
}

/** Google refused a request for quota: the day is spent, whatever we counted. */
export class QuotaRefused extends Error {
  override name = 'QuotaRefused';
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_LIMIT = /^\d{4}-\d{2}-\d{2} limit$/;

/** The Google day `now` falls in: its date in Los Angeles. */
export function quotaDay(now: Date): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The ledger in `text`; empty text is an empty ledger. Throws on anything else. */
export function parseLedger(text: string): Ledger {
  if (text.trim() === '') return {};
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('ledger: not an object');
  for (const [key, value] of Object.entries(raw)) {
    if (!DAY.test(key) && !DAY_LIMIT.test(key))
      throw new Error(`ledger: unknown key "${key}"`);
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
      throw new Error(`ledger: ${key} is not a whole number`);
  }
  return raw as Ledger;
}

/** The day's limit: a recorded raise for that day alone, else the default. */
export function limitFor(ledger: Ledger, day: string): number {
  return ledger[`${day} limit`] ?? DAILY_CHARACTERS;
}

/** What the day still allows, never below nothing. */
export function charactersLeft(ledger: Ledger, day: string): number {
  return Math.max(0, limitFor(ledger, day) - (ledger[day] ?? 0));
}

interface Holder {
  readonly pid: number;
  readonly worktree: string;
  readonly started: string;
}

function readHolder(text: string | undefined): Holder | undefined {
  if (text === undefined) return undefined;
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return undefined;
    const { pid, worktree, started } = raw as Record<string, unknown>;
    if (typeof pid !== 'number') return undefined;
    return { pid, worktree: String(worktree), started: String(started) };
  } catch {
    return undefined;
  }
}

/**
 * Runs `work` holding the machine-wide lock. A live holder is waited for in
 * one-second steps up to ten minutes, then named; a lock whose pid no longer
 * runs, or that cannot be read, is taken over at once. The lock is removed
 * however `work` ends.
 */
export async function withLock<T>(
  paths: LedgerPaths,
  deps: LedgerDeps,
  work: () => Promise<T>,
): Promise<T> {
  const mine = JSON.stringify({
    pid: deps.pid,
    worktree: deps.worktree,
    started: deps.now().toISOString(),
  });
  let waited = 0;
  while (!(await deps.create(paths.lock, mine))) {
    const holder = readHolder(await deps.read(paths.lock));
    if (holder === undefined || !deps.alive(holder.pid)) {
      await deps.remove(paths.lock);
      continue;
    }
    if (waited >= LOCK_CEILING_MS)
      throw new Error(
        `google-translate.lock: held by pid ${String(holder.pid)} (${holder.worktree}, since ${holder.started}) for ${String(LOCK_CEILING_MS / 60_000)} minutes`,
      );
    await deps.sleep(LOCK_STEP_MS);
    waited += LOCK_STEP_MS;
  }
  try {
    return await work();
  } finally {
    await deps.remove(paths.lock);
  }
}

async function readLedger(
  paths: LedgerPaths,
  deps: LedgerDeps,
): Promise<Ledger> {
  return parseLedger((await deps.read(paths.ledger)) ?? '');
}

async function writeLedger(
  paths: LedgerPaths,
  deps: LedgerDeps,
  ledger: Ledger,
): Promise<void> {
  const tmp = `${paths.ledger}.${String(deps.pid)}.tmp`;
  await deps.write(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
  await deps.rename(tmp, paths.ledger);
}

/**
 * Sends one request of `characters` through `send`, counted on the ledger.
 * Refused, sending nothing, when it would pass the day's limit. A quota
 * refusal from Google marks the day spent; any other failure is still
 * counted, since Google may have read the request.
 */
export async function counted<T>(
  paths: LedgerPaths,
  deps: LedgerDeps,
  characters: number,
  send: () => Promise<T>,
): Promise<T> {
  const day = quotaDay(deps.now());
  const before = await readLedger(paths, deps);
  if (characters > charactersLeft(before, day))
    throw new Error(
      `Google read-back: ${String(characters)} characters would pass ${day}'s limit of ${String(limitFor(before, day))} (${String(before[day] ?? 0)} spent)`,
    );
  let result: T;
  try {
    result = await send();
  } catch (error) {
    const after = await readLedger(paths, deps);
    const spent =
      error instanceof QuotaRefused
        ? Math.max(after[day] ?? 0, limitFor(after, day))
        : (after[day] ?? 0) + characters;
    await writeLedger(paths, deps, { ...after, [day]: spent });
    throw error;
  }
  const after = await readLedger(paths, deps);
  await writeLedger(paths, deps, {
    ...after,
    [day]: (after[day] ?? 0) + characters,
  });
  return result;
}
