/**
 * What a webhook says changed, and whether a board read has caught up with it
 * (#689). GitHub can answer a read made just after its webhook with the board
 * as it was before the change, so a read that ran after an event has not
 * necessarily seen it. Each `issues` and `projects_v2_item` delivery names one
 * card and when it last changed (its witness); a read has seen the event only
 * when it shows that card at or after that time.
 *
 * A difference between two reads is explained only by a witness naming that
 * card. Nothing else explains it: not the time of the last event, nor another
 * card's webhook. A witness stays owed until a read shows it, so a read that
 * lagged neither hides a missed webhook nor raises a false one.
 */
import type { BoardItem } from '@yawelo-idle/progress';

/** One card an event changed, and the time GitHub stamped the change. */
export type Witness =
  | { kind: 'issue'; number: number; updatedAt: string }
  /** `gone`: archived or deleted, which the board query no longer returns. */
  | { kind: 'item'; id: string; updatedAt: string; gone: boolean };

/** Each card's and each of this repository's issues' last change, as read. */
export interface Stamps {
  /** Card id → this repository's issue number (else null) and its stamp. */
  items: Map<string, { number: number | null; updatedAt: string }>;
  issues: Map<number, string>;
}

/** A witness no read has shown yet, and when its event arrived. */
export interface Owed {
  witness: Witness;
  at: number;
}

/**
 * GitHub's `projects_v2_item` actions (webhook docs, read 2026-10-19), and
 * whether the card leaves the board's default read. `items` returns only
 * cards that are not archived (`archivedStates = [NOT_ARCHIVED]`, GraphQL
 * schema read 2026-10-19).
 */
const GONE: Readonly<Record<string, boolean>> = {
  archived: true,
  converted: false,
  created: false,
  deleted: true,
  edited: false,
  reordered: false,
  restored: false,
};

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;

const stamp = (value: unknown): string | null =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null;

/**
 * The witness a delivery carries, or null when it carries none: then it
 * still causes a read, but explains no difference.
 */
export function eventWitness(name: string, payload: unknown): Witness | null {
  if (name === 'issues') {
    const issue = field(payload, 'issue');
    const number = field(issue, 'number');
    const updatedAt = stamp(field(issue, 'updated_at'));
    if (!Number.isInteger(number) || updatedAt === null) return null;
    return { kind: 'issue', number: number as number, updatedAt };
  }
  if (name === 'projects_v2_item') {
    const action = field(payload, 'action');
    const card = field(payload, 'projects_v2_item');
    const id = field(card, 'node_id');
    const updatedAt = stamp(field(card, 'updated_at'));
    if (typeof action !== 'string' || !Object.hasOwn(GONE, action)) return null;
    if (typeof id !== 'string' || updatedAt === null) return null;
    return { kind: 'item', id, updatedAt, gone: GONE[action] === true };
  }
  return null;
}

/**
 * The stamps of every card on the pages BOARD_QUERY returned. A card without
 * an id or a stamp is left out, so no card witness is ever seen in it; its
 * issue's own stamp is still read, since an issue witness is judged on that
 * alone.
 */
export function readStamps(pages: unknown[], repo: string): Stamps {
  const stamps: Stamps = { items: new Map(), issues: new Map() };
  for (const page of pages) {
    const nodes = field(
      field(field(field(page, 'data'), 'node'), 'items'),
      'nodes',
    );
    if (!Array.isArray(nodes)) continue;
    // A runtime population: the cards GitHub returned on this page.
    for (const node of nodes) {
      const content = field(node, 'content');
      const number = field(content, 'number');
      const ours =
        field(content, '__typename') === 'Issue' &&
        field(field(content, 'repository'), 'nameWithOwner') === repo &&
        Number.isInteger(number);
      const issueAt = stamp(field(content, 'updatedAt'));
      if (ours && issueAt !== null)
        stamps.issues.set(number as number, issueAt);
      const id = field(node, 'id');
      const updatedAt = stamp(field(node, 'updatedAt'));
      if (typeof id !== 'string' || updatedAt === null) continue;
      stamps.items.set(id, {
        number: ours ? (number as number) : null,
        updatedAt,
      });
    }
  }
  return stamps;
}

const atOrAfter = (read: string, witness: string): boolean =>
  Date.parse(read) >= Date.parse(witness);

/** Whether the read shows the board at or after the witness's change. */
export function sees(stamps: Stamps, witness: Witness): boolean {
  if (witness.kind === 'issue') {
    const read = stamps.issues.get(witness.number);
    return read !== undefined && atOrAfter(read, witness.updatedAt);
  }
  const read = stamps.items.get(witness.id);
  if (read === undefined) return witness.gone;
  return atOrAfter(read.updatedAt, witness.updatedAt);
}

/**
 * Whether an unseen witness means the read lagged. An issue the read does not
 * have is not on this board (its card's own event covers it if it joins), so
 * it says nothing about the read.
 */
const lagged = (stamps: Stamps, witness: Witness): boolean =>
  witness.kind === 'item' || stamps.issues.has(witness.number);

/**
 * The issue number a witness names: an issue's own, or a card's from this
 * read, else from the cards known before it (a card gone from the board).
 */
export function numberOf(
  witness: Witness,
  stamps: Stamps,
  known: Readonly<Record<string, number>>,
): number | null {
  if (witness.kind === 'issue') return witness.number;
  const read = stamps.items.get(witness.id);
  if (read !== undefined) return read.number;
  return known[witness.id] ?? null;
}

/** The issue numbers whose roadmap item differs between two reads. */
function changedNumbers(previous: BoardItem[], items: BoardItem[]): number[] {
  const before = new Map(previous.map((i) => [i.number, JSON.stringify(i)]));
  const after = new Map(items.map((i) => [i.number, JSON.stringify(i)]));
  const numbers = new Set([...before.keys(), ...after.keys()]);
  return [...numbers]
    .filter((n) => before.get(n) !== after.get(n))
    .sort((a, b) => a - b);
}

export interface Accounting {
  /** Changed cards a seen witness named. */
  explained: number[];
  /** Changed cards no seen witness named. */
  unexplained: number[];
  /** Witnesses still unseen and not expired, kept for the next read. */
  owed: Owed[];
  /** A witness from before this read began is unseen though it should show. */
  behind: boolean;
  /** Expired witnesses dropped unseen though their card was on the board. */
  unseen: number;
}

/**
 * One good read's accounting: which changes since the previous read the
 * owed witnesses explain, which witnesses the read showed, and whether it
 * lagged. `expiresBefore` (a check's start less the grace) drops witnesses
 * from before it that this read still does not show.
 */
export function account(input: {
  previous: BoardItem[] | null;
  items: BoardItem[];
  stamps: Stamps;
  owed: Owed[];
  known: Readonly<Record<string, number>>;
  startedAt: number;
  expiresBefore: number | null;
}): Accounting {
  const { stamps, startedAt, expiresBefore } = input;
  const named = new Set<number>();
  const owed: Owed[] = [];
  let behind = false;
  let unseen = 0;
  for (const entry of input.owed) {
    const { witness, at } = entry;
    if (sees(stamps, witness)) {
      const number = numberOf(witness, stamps, input.known);
      if (number !== null) named.add(number);
      continue;
    }
    const shouldShow = lagged(stamps, witness);
    if (shouldShow && at <= startedAt) behind = true;
    if (expiresBefore !== null && at < expiresBefore) {
      if (shouldShow) unseen += 1;
      continue;
    }
    owed.push(entry);
  }
  const changed =
    input.previous === null ? [] : changedNumbers(input.previous, input.items);
  return {
    explained: changed.filter((n) => named.has(n)),
    unexplained: changed.filter((n) => !named.has(n)),
    owed,
    behind,
    unseen,
  };
}
