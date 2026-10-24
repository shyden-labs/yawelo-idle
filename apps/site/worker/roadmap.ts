/**
 * The `Roadmap` Durable Object (#341, website spec §5.2 items 3–6): the one
 * snapshot of the board the public roadmap shows, its version, and the
 * health of the two ways it learns of changes.
 *
 * - An accepted webhook (`changed`) names the card it changed and when (its
 *   witness, worker/witness.ts) and asks for a read: reads are coalesced, so
 *   any burst costs at most two.
 * - Every good read accounts for what changed since the last one, card by
 *   card (#689): a change is explained only by a witness naming that card
 *   that the read shows. A witness the read does not show yet (GitHub
 *   answering from before its own webhook) stays owed for the next read, and
 *   the read is counted as late; it explains nothing else.
 * - The scheduled check (`check`, every 10 minutes) reads the whole board on
 *   its own. A difference no witness explains within the grace is drift,
 *   made loud by `/api/roadmap/health` and dev verify until a webhook is seen
 *   delivering a change again; it is an independent reading of the source of
 *   truth, not a retry.
 * - A failed read keeps the last snapshot and says since when reads fail. A
 *   board listing short of the issues the repository names on it is a failed
 *   read (#751), since the listing's own count shrinks with it.
 *   Nothing reads again by itself: the next event or check is the next read.
 *
 * Each new version goes to every open page over hibernating WebSockets.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  assertBoard,
  assertNamedByRepo,
  formatLines,
  progress,
  roadmapItems,
  type BoardItem,
  type Dropped,
  type Progress,
} from '@yawelo-idle/progress';
import {
  installationToken,
  readBoardPages,
  readRepoIssuePages,
} from './github.ts';
import {
  account,
  numberOf,
  readStamps,
  type Owed,
  type Stamps,
  type Witness,
} from './witness.ts';

/**
 * A late webhook is believed for this long after the read that saw its
 * change, and a check drops a witness still unseen this long after its event.
 */
export const GRACE_MS = 120_000;

/** No read's stamps: a card's number then comes from the cards known before. */
const NO_STAMPS: Stamps = { items: new Map(), issues: new Map() };

/**
 * The App's key, a Worker secret, which `wrangler types` cannot see; the
 * App's id and the board's vars are committed config it can (#341).
 */
export interface RoadmapEnv extends Env {
  readonly ROADMAP_APP_KEY?: string;
}

/** What `/api/roadmap.json` serves and each socket receives. */
export interface Snapshot {
  version: number;
  readAt: string;
  /** SHA-256 of the items: the only thing that makes a new version. */
  hash: string;
  items: BoardItem[];
  progress: Progress;
  lines: [string, string];
}

/**
 * Cards the roadmap leaves off, by kind (#341). Counted, never named: the
 * snapshot and the health are public in production, and a draft's title or
 * another repository's issue must never be shown (spec §5.2 item 1).
 */
export interface DroppedCounts {
  draft: number;
  pullRequest: number;
  anotherRepository: number;
}

const KEY_OF: Record<Dropped['kind'], keyof DroppedCounts> = {
  draft: 'draft',
  'pull request': 'pullRequest',
  'another repository': 'anotherRepository',
};

function countDropped(dropped: Dropped[]): DroppedCounts {
  const counts: DroppedCounts = {
    draft: 0,
    pullRequest: 0,
    anotherRepository: 0,
  };
  for (const { kind } of dropped) counts[KEY_OF[kind]] += 1;
  return counts;
}

/** What `/api/roadmap/health` serves. */
export interface Health {
  lastEventAt: string | null;
  lastCheckAt: string | null;
  version: number;
  /**
   * Unexplained differences since a webhook last delivered a change. It
   * never expires: only a webhook seen working again clears it (operator
   * decision 2026-10-06), so a missed webhook stays red until it is fixed.
   */
  drift: number;
  driftTotal: number;
  lastDriftAt: string | null;
  /** The earliest unexplained change still within its grace. */
  pendingDriftSince: string | null;
  /**
   * Good reads that did not yet show a change a webhook had announced
   * (#689): GitHub answering from before its own webhook. Never reset.
   */
  staleReads: number;
  lastStaleReadAt: string | null;
  /**
   * Announced changes no read showed within the grace of a check, dropped
   * so they cannot explain later changes. Never reset.
   */
  unseenEvents: number;
  readFailingSince: string | null;
  readError: string | null;
  /** What the last good read left off. */
  dropped: DroppedCounts;
}

interface State {
  snapshot: Snapshot | null;
  /** Witnesses no read has shown yet. */
  owed: Owed[];
  /** Each card id the last good read had → its issue number. */
  known: Record<string, number>;
  /** Issue number → when a read found its change unexplained, within the grace. */
  pending: Record<string, number>;
  lastEventAt: number | null;
  lastCheckAt: number | null;
  drift: number;
  driftTotal: number;
  lastDriftAt: number | null;
  staleReads: number;
  lastStaleReadAt: number | null;
  unseenEvents: number;
  readFailingSince: number | null;
  readError: string | null;
  dropped: DroppedCounts;
}

const EMPTY: State = {
  snapshot: null,
  owed: [],
  known: {},
  pending: {},
  lastEventAt: null,
  lastCheckAt: null,
  drift: 0,
  driftTotal: 0,
  lastDriftAt: null,
  staleReads: 0,
  lastStaleReadAt: null,
  unseenEvents: 0,
  readFailingSince: null,
  readError: null,
  dropped: { draft: 0, pullRequest: 0, anotherRepository: 0 },
};

const iso = (ms: number | null): string | null =>
  ms === null ? null : new Date(ms).toISOString();

/** The earliest of the pending changes' times, or null when none waits. */
const earliest = (pending: Record<string, number>): number | null => {
  const times = Object.values(pending);
  return times.length === 0 ? null : Math.min(...times);
};

/** Each of this repository's cards in a read → its issue number. */
function knownNumbers(stamps: Stamps): Record<string, number> {
  const known: Record<string, number> = {};
  // A runtime population: the cards this read returned.
  for (const [id, { number }] of stamps.items)
    if (number !== null) known[id] = number;
  return known;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class Roadmap extends DurableObject<RoadmapEnv> {
  private state: State = { ...EMPTY };
  /** Set by an event while a read runs: one more read follows it. */
  private dirty = false;
  /** The running read loop, if any. */
  private draining: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: RoadmapEnv) {
    super(ctx, env);
    // The runtime answers a live socket's ping itself, without waking the
    // object: a keep-alive for viewers, and an ordered marker that lets a test
    // tell "no new version was sent" from "not yet arrived" (#341).
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
    // State saved before #689 also holds `lastReadStartedAt` and a single
    // `pendingDriftSince`; nothing reads either any more.
    void ctx.blockConcurrencyWhile(async () => {
      this.state = {
        ...EMPTY,
        ...(await ctx.storage.get<Partial<State>>('state')),
      };
    });
  }

  /** The clock; a test replaces it to move time. */
  now(): number {
    return Date.now();
  }

  /**
   * An accepted webhook: the card it names changed. A delivery that names no
   * card (null) still causes a read but explains no change.
   */
  async changed(witness: Witness | null): Promise<void> {
    const now = this.now();
    this.promoteStalePending(now);
    if (witness !== null) {
      // A late webhook for a change a read already found explains that card
      // alone, and only within the grace.
      const number = numberOf(witness, NO_STAMPS, this.state.known);
      this.keepPending(
        ([card, since]) => card !== String(number) || now - since > GRACE_MS,
      );
      this.state.owed.push({ witness, at: now });
    }
    this.state.lastEventAt = now;
    await this.save();
    this.dirty = true;
    await this.drain();
  }

  /** The scheduled check: an independent read of the whole board. */
  async check(): Promise<void> {
    if (this.draining !== null) await this.draining;
    const now = this.now();
    this.promoteStalePending(now);
    this.state.lastCheckAt = now;
    await this.read('check');
  }

  async health(): Promise<Health> {
    if (this.state.lastCheckAt === null) await this.check();
    const now = this.now();
    this.promoteStalePending(now);
    await this.save();
    const s = this.state;
    return {
      lastEventAt: iso(s.lastEventAt),
      lastCheckAt: iso(s.lastCheckAt),
      version: s.snapshot?.version ?? 0,
      drift: s.drift,
      driftTotal: s.driftTotal,
      lastDriftAt: iso(s.lastDriftAt),
      pendingDriftSince: iso(earliest(s.pending)),
      staleReads: s.staleReads,
      lastStaleReadAt: iso(s.lastStaleReadAt),
      unseenEvents: s.unseenEvents,
      readFailingSince: iso(s.readFailingSince),
      readError: s.readError,
      dropped: s.dropped,
    };
  }

  async snapshot(): Promise<Snapshot | null> {
    if (this.state.lastCheckAt === null) await this.check();
    return this.state.snapshot;
  }

  /** `/api/roadmap/live`: a hibernating socket that gets every version. */
  override fetch(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('expected a WebSocket upgrade', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair()) as [
      WebSocket,
      WebSocket,
    ];
    this.ctx.acceptWebSocket(server);
    if (this.state.snapshot !== null)
      server.send(JSON.stringify(this.state.snapshot));
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    ws.close(code, reason);
  }

  /** Reads until no event arrived during the last read. */
  private drain(): Promise<void> {
    this.draining ??= (async () => {
      try {
        while (this.dirty) {
          this.dirty = false;
          await this.read('event');
        }
      } finally {
        this.draining = null;
      }
    })();
    return this.draining;
  }

  private async read(source: 'event' | 'check'): Promise<void> {
    const startedAt = this.now();
    const env = this.env;
    try {
      if (env.ROADMAP_APP_KEY === undefined)
        throw new Error('ROADMAP_APP_KEY is not set');
      const [owner = '', name = ''] = env.ROADMAP_REPO.split('/');
      const token = await installationToken(
        {
          appId: env.ROADMAP_APP_ID,
          key: env.ROADMAP_APP_KEY,
          org: owner,
          repoName: name,
        },
        // GitHub judges the JWT by the wall clock, never by `now()`.
        Math.floor(Date.now() / 1000),
      );
      const pages = await readBoardPages(token, env.ROADMAP_BOARD_ID);
      assertBoard(pages, env.ROADMAP_BOARD_TITLE);
      // The listing's own count shrinks with it, so a short read is caught
      // against the repository's issues, from a second surface (#751).
      assertNamedByRepo(
        pages,
        await readRepoIssuePages(token, owner, name),
        env.ROADMAP_BOARD_ID,
        env.ROADMAP_REPO,
      );
      const { items, dropped } = roadmapItems(pages, env.ROADMAP_REPO);
      const sorted = [...items].sort((a, b) => a.number - b.number);
      const hash = await sha256(JSON.stringify(sorted));
      // From here to the save nothing awaits, so every witness that arrived
      // during the read is in the accounting and none is lost.
      const previous = this.state.snapshot;
      const stamps = readStamps(pages, env.ROADMAP_REPO);
      const counted = account({
        previous: previous?.items ?? null,
        items: sorted,
        stamps,
        owed: this.state.owed,
        known: this.state.known,
        startedAt,
        expiresBefore: source === 'check' ? startedAt - GRACE_MS : null,
      });
      this.state.owed = counted.owed;
      this.state.known = knownNumbers(stamps);
      if (counted.behind) {
        this.state.staleReads += 1;
        this.state.lastStaleReadAt = startedAt;
      }
      this.state.unseenEvents += counted.unseen;
      // A runtime population: the cards this read found changed unexplained.
      for (const number of counted.unexplained)
        this.state.pending[String(number)] ??= startedAt;
      // A webhook delivered a change before any read found it without one:
      // the delivery path works, so earlier drift is fixed.
      if (counted.explained.length > 0) this.state.drift = 0;
      if (previous?.hash !== hash) {
        const today = new Date(startedAt).toISOString().slice(0, 10);
        const measured = progress(sorted, today);
        this.state.snapshot = {
          version: (previous?.version ?? 0) + 1,
          readAt: new Date(startedAt).toISOString(),
          hash,
          items: sorted,
          progress: measured,
          lines: formatLines(measured, today),
        };
        this.broadcast();
      }
      this.state.dropped = countDropped(dropped);
      this.state.readFailingSince = null;
      this.state.readError = null;
    } catch (error) {
      this.state.readFailingSince ??= startedAt;
      this.state.readError =
        error instanceof Error ? error.message : String(error);
    }
    await this.save();
  }

  /** Each card's change no late webhook explained within the grace is drift. */
  private promoteStalePending(now: number): void {
    this.keepPending(([, since]) => {
      if (now - since <= GRACE_MS) return true;
      this.state.drift += 1;
      this.state.driftTotal += 1;
      this.state.lastDriftAt = Math.max(this.state.lastDriftAt ?? since, since);
      return false;
    });
  }

  /** Keeps the pending changes `keep` accepts, by card number and time. */
  private keepPending(keep: (entry: [string, number]) => boolean): void {
    this.state.pending = Object.fromEntries(
      Object.entries(this.state.pending).filter(keep),
    );
  }

  private broadcast(): void {
    const message = JSON.stringify(this.state.snapshot);
    // A runtime population: the sockets open at this moment.
    for (const socket of this.ctx.getWebSockets()) socket.send(message);
  }

  private save(): Promise<void> {
    return this.ctx.storage.put('state', this.state);
  }
}
