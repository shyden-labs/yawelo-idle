/**
 * A board as `gh api graphql --paginate --slurp` returns it for BOARD_QUERY:
 * two pages of raw GraphQL, with every kind of item the maths treats
 * differently. Dates are relative to `today`, so the pace window holds the
 * same closures whatever day a test runs. One fixture for every reader of
 * packages/progress: the module's own tests, the wrapper script's (#340) and
 * the Worker's (#341), so they can be held to identical output.
 */
export const FIXTURE_TITLE = 'Fixture Stories';
/** The repository whose issues the fixture's board holds (#341). */
export const FIXTURE_REPO = 'shyden-labs/fixture';

const DAY_MS = 86_400_000;

function daysBefore(today: string, days: number): string {
  return new Date(Date.parse(`${today}T12:00:00Z`) - days * DAY_MS)
    .toISOString()
    .replace('.000', '');
}

interface Story {
  number: number;
  title: string;
  estimate: number | null;
  labels?: string[];
  /** Days before `today` it closed; absent while open. */
  closed?: number;
  stateReason?: 'COMPLETED' | 'NOT_PLANNED';
}

/** A fixture card's id, as GitHub's `PVTI_` node ids look (#689). */
export const fixtureCardId = (number: number): string =>
  `PVTI_fixture_${String(number)}`;

function node(today: string, story: Story): unknown {
  const labels = story.labels ?? [];
  // A card and its issue last changed when the issue closed, else when it
  // was filed.
  const updatedAt =
    story.closed === undefined
      ? daysBefore(today, 30)
      : daysBefore(today, story.closed);
  return {
    id: fixtureCardId(story.number),
    updatedAt,
    estimate: story.estimate === null ? null : { number: story.estimate },
    content: {
      __typename: 'Issue',
      number: story.number,
      title: story.title,
      state: story.closed === undefined ? 'OPEN' : 'CLOSED',
      stateReason:
        story.closed === undefined ? null : (story.stateReason ?? 'COMPLETED'),
      createdAt: daysBefore(today, 30),
      closedAt:
        story.closed === undefined ? null : daysBefore(today, story.closed),
      updatedAt,
      labels: {
        totalCount: labels.length,
        nodes: labels.map((name) => ({ name })),
      },
      repository: { nameWithOwner: FIXTURE_REPO },
    },
  };
}

/** One page, with the count of every item on the board that GitHub gives each page (#703). */
function page(today: string, stories: Story[], totalCount: number): unknown {
  return {
    data: {
      node: {
        title: FIXTURE_TITLE,
        items: {
          totalCount,
          nodes: stories.map((story) => node(today, story)),
        },
      },
    },
  };
}

/** The fixture board's node id, which the repository's issues name (#751). */
export const FIXTURE_BOARD_ID = 'PVT_fixture';

/** One page of the repository's issues as REPO_ISSUES_QUERY returns it (#751). */
function repoPage(issues: [number, string[]][], totalCount: number): unknown {
  return {
    data: {
      repository: {
        issues: {
          totalCount,
          nodes: issues.map(([number, boards]) => ({
            number,
            projectItems: {
              totalCount: boards.length,
              nodes: boards.map((id) => ({ project: { id } })),
            },
          })),
        },
      },
    },
  };
}

/**
 * The fixture repository's issues, each with the boards it is on (#751):
 * #1 to #9 name the fixture board, as its cards say; #10 is on another board
 * and #11 on none, so a cross-check must read the board's id, not just count.
 */
export function repoPages(): unknown[] {
  const pages: [number, string[]][][] = [
    [
      [1, [FIXTURE_BOARD_ID]],
      [2, [FIXTURE_BOARD_ID]],
      [3, [FIXTURE_BOARD_ID, 'PVT_other']],
      [4, [FIXTURE_BOARD_ID]],
      [5, [FIXTURE_BOARD_ID]],
      [6, [FIXTURE_BOARD_ID]],
    ],
    [
      [7, [FIXTURE_BOARD_ID]],
      [8, [FIXTURE_BOARD_ID]],
      [9, [FIXTURE_BOARD_ID]],
      [10, ['PVT_other']],
      [11, []],
    ],
  ];
  const totalCount = pages.flat().length;
  return pages.map((issues) => repoPage(issues, totalCount));
}

export function boardPages(today: string): unknown[] {
  const pages: Story[][] = [
    [
      { number: 1, title: 'Epic M1: Core', estimate: null },
      { number: 2, title: 'Story two', estimate: 5, closed: 1 },
      { number: 3, title: 'Story three', estimate: 3, closed: 3 },
      { number: 4, title: 'Story four', estimate: null, closed: 20 },
      { number: 5, title: 'Story five', estimate: 8 },
    ],
    [
      { number: 6, title: 'Story six', estimate: 13 },
      {
        number: 7,
        title: 'Story seven',
        estimate: 2,
        labels: ['post-launch'],
      },
      {
        number: 8,
        title: 'Story eight',
        estimate: 3,
        closed: 0,
        stateReason: 'NOT_PLANNED',
      },
      { number: 9, title: 'Story nine', estimate: 3 },
    ],
  ];
  const totalCount = pages.flat().length;
  return pages.map((stories) => page(today, stories, totalCount));
}
