import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Every board reader proves it read the whole board (#703), each row
 * predicted before its first run: each of assertWhole's four refusals
 * dropped, board-next reading without assertBoard, and each query no longer
 * asking for the board's item count. Unit-suite mutations; the roadmap
 * Worker's own case is 703-roadmap-reads-whole.ts.
 */

const PROGRESS = 'packages/progress/test/progress.test.ts';
const WHOLE = `${PROGRESS} › assertBoard refuses a read that is not the whole board (#703) >`;
const CLOSE_OUT = `${PROGRESS} › closeOutLines >`;
const QUERY = `${PROGRESS} › BOARD_QUERY >`;
const NEXT = 'tests/unit/board-next.test.ts';
const NEXT_PARSE = `${NEXT} › parseNextItems reads the board whole (#576) >`;
const NEXT_WHOLE = `${NEXT} › parseNextItems refuses a read that is not the whole board (#703) >`;
const NEXT_SCRIPT = `${NEXT} › boardNext (#576) >`;
const ORPHANS = 'tests/unit/board-orphans.test.ts';
const ORPHANS_CLOSED = `${ORPHANS} › boardOrphans fails closed when it cannot look (#580 AC2, AC3) >`;
const PROGRESS_SCRIPT = 'tests/unit/board-progress.test.ts';
const PROGRESS_RUN = `${PROGRESS_SCRIPT} › boardProgress (#340, in-process since #490) >`;
const NOTHING_THROWN = 'to throw an error';

export default mutationFile({
  targets: [PROGRESS, NEXT, ORPHANS, PROGRESS_SCRIPT],
  mutations: [
    {
      // No pages: no count to compare, so the short-read check sees NaN.
      name: 'no-pages-pass',
      file: 'packages/progress/src/index.ts',
      anchor: '  if (boards.length === 0)\n',
      replacement: '  if (false)\n',
      red: {
        [`${WHOLE} refuses a read of no pages`]: 'the board has NaN items',
      },
    },
    {
      // An uncounted page then reaches the change check, naming its count.
      name: 'count-unchecked',
      file: 'packages/progress/src/index.ts',
      // Anchored on its message too: #751's repository check has the same if.
      anchor:
        "  if (!counts.every((count) => Number.isInteger(count)))\n    throw new Error(\n      'a page came back without the board’s",
      replacement:
        "  if (false)\n    throw new Error(\n      'a page came back without the board’s",
      red: {
        [`${WHOLE} refuses a page that gives no count`]:
          'report , then 9 items',
        [`${WHOLE} refuses a count that is not a whole number`]:
          'report 9, then 9 items',
      },
    },
    {
      // The first page's count matches what was read, so nothing is refused.
      name: 'changed-board-unnamed',
      file: 'packages/progress/src/index.ts',
      // Anchored on its message too: #751's repository check has the same if.
      anchor:
        '  if (seen.length > 1)\n    throw new Error(\n      `the board changed',
      replacement:
        '  if (false)\n    throw new Error(\n      `the board changed',
      red: {
        [`${WHOLE} names a board that changed while it was read, giving each count`]:
          NOTHING_THROWN,
        [`${NEXT_WHOLE} names a board that changed while it was read`]:
          NOTHING_THROWN,
      },
    },
    {
      name: 'short-read-passes',
      file: 'packages/progress/src/index.ts',
      anchor: '  if (read !== total)\n',
      replacement: '  if (false)\n',
      red: {
        [`${WHOLE} refuses a short page, giving both numbers`]: NOTHING_THROWN,
        [`${WHOLE} refuses a read missing a page, giving both numbers`]:
          NOTHING_THROWN,
        [`${CLOSE_OUT} refuses a read missing a page, giving no lines (#703)`]:
          NOTHING_THROWN,
        [`${NEXT_WHOLE} refuses a short page, giving both numbers`]:
          NOTHING_THROWN,
        [`${NEXT_WHOLE} refuses a read missing a page, giving both numbers`]:
          NOTHING_THROWN,
        [`${NEXT_SCRIPT} refuses a short read, naming no ticket (#703)`]:
          NOTHING_THROWN,
        [`${ORPHANS_CLOSED} fails, naming the board, when the read is short of the board (#703)`]:
          NOTHING_THROWN,
        // Since #751 the repository's issues still name all 9, so the
        // cross-check refuses the 5 read, under another message.
        [`${PROGRESS_RUN} refuses a read missing a page, giving no line (#703)`]:
          'the board lists 5 of',
      },
    },
    {
      // board-next and board-orphans then check neither title nor count.
      name: 'next-skips-board-check',
      file: 'scripts/board-next.ts',
      anchor: '  assertBoard(pages, title);\n',
      replacement: '',
      red: {
        [`${NEXT_PARSE} refuses a page whose board title differs`]:
          NOTHING_THROWN,
        [`${NEXT_WHOLE} refuses a short page, giving both numbers`]:
          NOTHING_THROWN,
        [`${NEXT_WHOLE} refuses a read missing a page, giving both numbers`]:
          NOTHING_THROWN,
        [`${NEXT_WHOLE} names a board that changed while it was read`]:
          NOTHING_THROWN,
        [`${NEXT_SCRIPT} refuses a short read, naming no ticket (#703)`]:
          NOTHING_THROWN,
        [`${ORPHANS_CLOSED} fails, naming the board, when the read is short of the board (#703)`]:
          NOTHING_THROWN,
        [`${ORPHANS_CLOSED} refuses another board's title`]: NOTHING_THROWN,
      },
    },
    {
      name: 'next-query-uncounted',
      file: 'scripts/board-next.ts',
      anchor: '{ totalCount pageInfo {',
      replacement: '{ pageInfo {',
      red: {
        [`${NEXT_WHOLE} asks GitHub how many items the board holds`]:
          'to match',
      },
    },
    {
      name: 'board-query-uncounted',
      file: 'packages/progress/src/index.ts',
      // The board's items, not #751's issues, which ask for their count too.
      anchor: 'items(first: 100, after: $endCursor) { totalCount pageInfo {',
      replacement: 'items(first: 100, after: $endCursor) { pageInfo {',
      red: {
        [`${QUERY} asks GitHub how many items the board holds`]: 'to match',
      },
    },
  ],
});
