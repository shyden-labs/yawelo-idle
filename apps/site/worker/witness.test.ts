import { describe, expect, it } from 'vitest';
import type { BoardItem } from '@yawelo-idle/progress';
import {
  account,
  eventWitness,
  numberOf,
  readStamps,
  sees,
  type Owed,
  type Stamps,
  type Witness,
} from './witness';

/**
 * What a webhook says changed, and whether a board read has caught up with it
 * (#689). A read GitHub answers from before the change it was told of must
 * not count as having seen it, and one card's webhook must never explain
 * another card's change.
 */
const REPO = 'shyden-labs/fixture';
const T0 = '2026-10-19T00:40:45Z';
const BEFORE = '2026-10-19T00:40:00Z';
const AFTER = '2026-10-19T00:41:30Z';

const issueEvent = (over: Record<string, unknown> = {}, action = 'closed') => ({
  action,
  issue: { number: 678, updated_at: T0, ...over },
  repository: { full_name: REPO },
});

const itemEvent = (action: string, over: Record<string, unknown> = {}) => ({
  action,
  projects_v2_item: {
    node_id: 'PVTI_678',
    project_node_id: 'PVT_board',
    updated_at: T0,
    ...over,
  },
});

describe('eventWitness', () => {
  // A deleted issue, or one transferred to another repository, leaves this
  // repository's board read for good, so it is seen by its absence (#689;
  // GitHub's recorded issues.deleted and issues.transferred payloads, read
  // 2026-10-19, name the old repository and number).
  const ISSUE_ACTIONS: [string, boolean][] = [
    ['closed', false],
    ['deleted', true],
    ['edited', false],
    ['transferred', true],
  ];
  for (const [action, gone] of ISSUE_ACTIONS) {
    it(`names the issue of an issues ${action} event, ${gone ? 'gone' : 'present'}`, () => {
      expect(eventWitness('issues', issueEvent({}, action))).toEqual({
        kind: 'issue',
        number: 678,
        updatedAt: T0,
        gone,
      });
    });
  }

  it('names nothing for an issues event without an action', () => {
    expect(
      eventWitness('issues', { ...issueEvent(), action: undefined }),
    ).toBeNull();
  });

  // GitHub's projects_v2_item actions (docs, read 2026-10-19). The board
  // query leaves archived cards out, so an archived or deleted card is seen
  // by its absence.
  const ACTIONS: [string, boolean][] = [
    ['archived', true],
    ['converted', false],
    ['created', false],
    ['deleted', true],
    ['edited', false],
    ['reordered', false],
    ['restored', false],
  ];
  for (const [action, gone] of ACTIONS) {
    it(`names the card of a projects_v2_item ${action} event, ${gone ? 'gone' : 'present'}`, () => {
      expect(eventWitness('projects_v2_item', itemEvent(action))).toEqual({
        kind: 'item',
        id: 'PVTI_678',
        updatedAt: T0,
        gone,
      });
    });
  }

  it('names nothing for an issues event without updated_at', () => {
    expect(
      eventWitness('issues', issueEvent({ updated_at: undefined })),
    ).toBeNull();
  });

  it('names nothing for an issues event whose updated_at is not a time', () => {
    expect(
      eventWitness('issues', issueEvent({ updated_at: 'yesterday' })),
    ).toBeNull();
  });

  it('names nothing for an issues event whose number is not a whole number', () => {
    expect(eventWitness('issues', issueEvent({ number: '678' }))).toBeNull();
  });

  it('names nothing for a card event without node_id', () => {
    expect(
      eventWitness('projects_v2_item', itemEvent('edited', { node_id: 7 })),
    ).toBeNull();
  });

  it('names nothing for a card event with an action GitHub does not send', () => {
    expect(
      eventWitness('projects_v2_item', itemEvent('teleported')),
    ).toBeNull();
  });

  it('names nothing for another event', () => {
    expect(eventWitness('push', issueEvent())).toBeNull();
  });
});

/** A board page as BOARD_QUERY returns it, with the stamps #689 asks for. */
const page = (nodes: unknown[]) => ({
  data: { node: { title: 'Fixture Stories', items: { nodes } } },
});
const issueNode = (
  number: number,
  updatedAt: string,
  repo = REPO,
  itemUpdatedAt = updatedAt,
) => ({
  id: `PVTI_${String(number)}`,
  updatedAt: itemUpdatedAt,
  estimate: null,
  content: {
    __typename: 'Issue',
    number,
    updatedAt,
    repository: { nameWithOwner: repo },
  },
});

describe('readStamps', () => {
  it('records a card of this repository with its number and both stamps', () => {
    const stamps = readStamps([page([issueNode(678, T0, REPO, AFTER)])], REPO);
    expect([...stamps.items]).toEqual([
      ['PVTI_678', { number: 678, updatedAt: AFTER }],
    ]);
    expect([...stamps.issues]).toEqual([[678, T0]]);
  });

  it('records another repository’s card with no number, and not its issue', () => {
    const stamps = readStamps(
      [page([issueNode(5, T0, 'shyden-labs/other'), issueNode(6, AFTER)])],
      REPO,
    );
    expect([...stamps.items]).toEqual([
      ['PVTI_5', { number: null, updatedAt: T0 }],
      ['PVTI_6', { number: 6, updatedAt: AFTER }],
    ]);
    expect([...stamps.issues]).toEqual([[6, AFTER]]);
  });

  it('records a draft card with no number', () => {
    const stamps = readStamps(
      [
        page([
          {
            id: 'PVTI_draft',
            updatedAt: T0,
            content: { __typename: 'DraftIssue', title: 'x' },
          },
        ]),
      ],
      REPO,
    );
    expect([...stamps.items]).toEqual([
      ['PVTI_draft', { number: null, updatedAt: T0 }],
    ]);
  });

  it('reads every page', () => {
    const stamps = readStamps(
      [page([issueNode(1, T0)]), page([issueNode(2, T0)])],
      REPO,
    );
    expect([...stamps.issues.keys()]).toEqual([1, 2]);
  });

  // An issue witness is judged on the issue's own stamp, so a card without
  // one of its own still gives its issue's (found by #691's fixture mutation).
  it('records no card without an id or a stamp, but still its issue’s last change', () => {
    const noId = { ...issueNode(1, T0), id: undefined };
    const noStamp = { ...issueNode(2, BEFORE), updatedAt: undefined };
    const stamps = readStamps(
      [page([noId, noStamp, issueNode(3, AFTER)])],
      REPO,
    );
    expect(stamps).toEqual({
      items: new Map([['PVTI_3', { number: 3, updatedAt: AFTER }]]),
      issues: new Map([
        [1, T0],
        [2, BEFORE],
        [3, AFTER],
      ]),
    });
  });
});

const stampsOf = (
  items: [string, number | null, string][],
  issues: [number, string][] = [],
): Stamps => ({
  items: new Map(
    items.map(([id, number, updatedAt]) => [id, { number, updatedAt }]),
  ),
  issues: new Map(issues),
});
const issueWitness: Witness = {
  kind: 'issue',
  number: 678,
  updatedAt: T0,
  gone: false,
};
const goneIssue: Witness = { ...issueWitness, gone: true };
const itemWitness: Witness = {
  kind: 'item',
  id: 'PVTI_678',
  updatedAt: T0,
  gone: false,
};
const goneWitness: Witness = { ...itemWitness, gone: true };

describe('sees', () => {
  it('sees an issue whose stamp is the witness’s', () => {
    expect(sees(stampsOf([], [[678, T0]]), issueWitness)).toBe(true);
  });

  it('sees an issue changed again since', () => {
    expect(sees(stampsOf([], [[678, AFTER]]), issueWitness)).toBe(true);
  });

  it('does not see an issue read from before the change', () => {
    expect(sees(stampsOf([], [[678, BEFORE]]), issueWitness)).toBe(false);
  });

  it('does not see an issue the read does not have', () => {
    expect(sees(stampsOf([]), issueWitness)).toBe(false);
  });

  it('sees a deleted or transferred issue by its absence', () => {
    expect(sees(stampsOf([], [[1, T0]]), goneIssue)).toBe(true);
  });

  it('does not see a gone issue the read still has, however new its stamp', () => {
    expect(sees(stampsOf([], [[678, AFTER]]), goneIssue)).toBe(false);
  });

  it('sees a card whose stamp is the witness’s', () => {
    expect(sees(stampsOf([['PVTI_678', 678, T0]]), itemWitness)).toBe(true);
  });

  it('does not see a card read from before the change', () => {
    expect(sees(stampsOf([['PVTI_678', 678, BEFORE]]), itemWitness)).toBe(
      false,
    );
  });

  it('does not see a new card the read does not have yet', () => {
    expect(sees(stampsOf([]), itemWitness)).toBe(false);
  });

  it('sees a gone card by its absence', () => {
    expect(sees(stampsOf([]), goneWitness)).toBe(true);
  });

  it('does not see a gone card the read still has from before', () => {
    expect(sees(stampsOf([['PVTI_678', 678, BEFORE]]), goneWitness)).toBe(
      false,
    );
  });

  it('sees a gone card restored since', () => {
    expect(sees(stampsOf([['PVTI_678', 678, AFTER]]), goneWitness)).toBe(true);
  });
});

describe('numberOf', () => {
  it('names an issue witness’s number', () => {
    expect(numberOf(issueWitness, stampsOf([]), {})).toBe(678);
  });

  it('names a card’s number from the read', () => {
    expect(numberOf(itemWitness, stampsOf([['PVTI_678', 42, T0]]), {})).toBe(
      42,
    );
  });

  it('names a card the read no longer has from the cards known before', () => {
    expect(numberOf(goneWitness, stampsOf([]), { PVTI_678: 42 })).toBe(42);
  });

  it('names no number for a card that is not this repository’s issue', () => {
    expect(
      numberOf(itemWitness, stampsOf([['PVTI_678', null, T0]]), {}),
    ).toBeNull();
  });
});

const item = (
  number: number,
  title = `Story ${String(number)}`,
): BoardItem => ({
  number,
  title,
  state: 'OPEN',
  stateReason: null,
  createdAt: '2026-10-01T00:00:00Z',
  closedAt: null,
  estimate: 3,
  labels: [],
  parent: null,
  publicTitle: null,
  publicSummary: null,
});
const STARTED = Date.parse('2026-10-19T00:41:00Z');
const owed = (witness: Witness, at = STARTED - 1_000): Owed => ({
  witness,
  at,
});
const base = {
  previous: [item(1), item(678)],
  known: {},
  startedAt: STARTED,
  expiresBefore: null,
};

describe('account', () => {
  it('explains a change on the card a seen witness names', () => {
    const result = account({
      ...base,
      items: [item(1), item(678, 'Closed now')],
      stamps: stampsOf([], [[678, T0]]),
      owed: [owed(issueWitness)],
    });
    expect(result).toEqual({
      explained: [678],
      unexplained: [],
      owed: [],
      behind: false,
      unseen: 0,
    });
  });

  it('explains a change through a card witness’s number in the read', () => {
    const result = account({
      ...base,
      items: [item(1), item(678, 'Edited')],
      stamps: stampsOf([['PVTI_678', 678, T0]]),
      owed: [owed(itemWitness)],
    });
    expect(result).toEqual({
      explained: [678],
      unexplained: [],
      owed: [],
      behind: false,
      unseen: 0,
    });
  });

  it('leaves a change unexplained when no event named it', () => {
    const result = account({
      ...base,
      items: [item(1, 'Missed'), item(678)],
      stamps: stampsOf([]),
      owed: [],
    });
    expect(result).toEqual({
      explained: [],
      unexplained: [1],
      owed: [],
      behind: false,
      unseen: 0,
    });
  });

  // Blind spot 1 (#689): one card's webhook used to explain every difference.
  it('leaves a change unexplained when a seen witness names another card', () => {
    const result = account({
      ...base,
      items: [item(1, 'Missed'), item(678, 'Closed now')],
      stamps: stampsOf([], [[678, T0]]),
      owed: [owed(issueWitness)],
    });
    expect(result.explained).toEqual([678]);
    expect(result.unexplained).toEqual([1]);
  });

  it('keeps a witness the read is behind on, and marks the read behind', () => {
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([], [[678, BEFORE]]),
      owed: [owed(issueWitness)],
    });
    expect(result).toEqual({
      explained: [],
      unexplained: [],
      owed: [owed(issueWitness)],
      behind: true,
      unseen: 0,
    });
  });

  it('explains the change once a later read sees the kept witness', () => {
    const result = account({
      ...base,
      items: [item(1), item(678, 'Closed now')],
      stamps: stampsOf([], [[678, T0]]),
      owed: [owed(issueWitness, STARTED - 600_000)],
    });
    expect(result).toEqual({
      explained: [678],
      unexplained: [],
      owed: [],
      behind: false,
      unseen: 0,
    });
  });

  // Blind spot 2 (#689): a card added to the board but not in the read yet.
  it('marks the read behind on a new card it does not have yet', () => {
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([]),
      owed: [owed(itemWitness)],
    });
    expect(result.behind).toBe(true);
    expect(result.owed).toEqual([owed(itemWitness)]);
  });

  it('does not mark the read behind on an issue that is not on this board', () => {
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([]),
      owed: [owed(issueWitness)],
    });
    expect(result.behind).toBe(false);
    expect(result.owed).toEqual([owed(issueWitness)]);
  });

  it('does not mark the read behind on a witness that came after it began', () => {
    const late = owed(issueWitness, STARTED + 1);
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([], [[678, BEFORE]]),
      owed: [late],
    });
    expect(result.behind).toBe(false);
    expect(result.owed).toEqual([late]);
  });

  it('explains a removed card through the number known before', () => {
    const result = account({
      ...base,
      items: [item(1)],
      stamps: stampsOf([]),
      owed: [owed(goneWitness)],
      known: { PVTI_678: 678 },
    });
    expect(result).toEqual({
      explained: [678],
      unexplained: [],
      owed: [],
      behind: false,
      unseen: 0,
    });
  });

  it('explains a deleted issue’s card leaving the board', () => {
    const result = account({
      ...base,
      items: [item(1)],
      stamps: stampsOf([], [[1, T0]]),
      owed: [owed(goneIssue)],
    });
    expect(result).toEqual({
      explained: [678],
      unexplained: [],
      owed: [],
      behind: false,
      unseen: 0,
    });
  });

  it('keeps a gone issue owed while the read still has it, and marks the read behind', () => {
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([], [[678, BEFORE]]),
      owed: [owed(goneIssue)],
    });
    expect(result).toEqual({
      explained: [],
      unexplained: [],
      owed: [owed(goneIssue)],
      behind: true,
      unseen: 0,
    });
  });

  it('leaves a removed card unexplained when no event named it', () => {
    const result = account({
      ...base,
      items: [item(1)],
      stamps: stampsOf([]),
      owed: [],
    });
    expect(result.unexplained).toEqual([678]);
  });

  it('leaves an added card unexplained when no event named it', () => {
    const result = account({
      ...base,
      items: [...base.previous, item(99)],
      stamps: stampsOf([]),
      owed: [],
    });
    expect(result.unexplained).toEqual([99]);
  });

  it('judges no change on the first read, though it still accounts for witnesses', () => {
    const result = account({
      ...base,
      previous: null,
      items: [item(1)],
      stamps: stampsOf([], [[678, BEFORE]]),
      owed: [owed(issueWitness)],
    });
    expect(result).toEqual({
      explained: [],
      unexplained: [],
      owed: [owed(issueWitness)],
      behind: true,
      unseen: 0,
    });
  });

  it('drops a witness unseen past the expiry, counting it when the read had its card', () => {
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([], [[678, BEFORE]]),
      owed: [owed(issueWitness, STARTED - 200_000)],
      expiresBefore: STARTED - 120_000,
    });
    expect(result).toEqual({
      explained: [],
      unexplained: [],
      owed: [],
      behind: true,
      unseen: 1,
    });
  });

  it('drops an expired witness for an issue not on this board without counting it', () => {
    // A young witness beside it is kept: only the expired one goes.
    const young = owed(itemWitness, STARTED - 60_000);
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([]),
      owed: [owed(issueWitness, STARTED - 200_000), young],
      expiresBefore: STARTED - 120_000,
    });
    expect(result).toEqual({
      explained: [],
      unexplained: [],
      owed: [young],
      behind: true,
      unseen: 0,
    });
  });

  it('keeps an unseen witness younger than the expiry', () => {
    const young = owed(issueWitness, STARTED - 60_000);
    const result = account({
      ...base,
      items: base.previous,
      stamps: stampsOf([], [[678, BEFORE]]),
      owed: [young],
      expiresBefore: STARTED - 120_000,
    });
    expect(result.owed).toEqual([young]);
    expect(result.unseen).toBe(0);
  });
});
