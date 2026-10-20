import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Dev verify judges the roadmap only from a check the deployed code made
 * (#708), and any failed read in it is red (Shyden, 2026-10-20: "treat any
 * failure as red", which retires #693's wait for a second failed check and
 * its mutation file). Predicted before the first run. Each row puts back one
 * way it could go wrong: the old code's record judged, the deploy's own
 * millisecond refused, an unreadable time called "before the deploy", the
 * stale record judged past its gate, #693's grace, the ceiling losing the
 * last check it saw, and a deploy time that is not a time accepted.
 */

const VERIFY = 'tests/unit/verify-dev.test.ts';
const JUDGED = `${VERIFY} › roadmapProblems (#341) >`;
const WAITED = `${VERIFY} › verifyDev > verifyRoadmap (#708) >`;
const BEFORE = `${JUDGED} refuses a check made before the deploy, naming both times, and judges nothing after it`;
const WAITS = `${WAITED} waits past checks the old code made, then judges the first one after the deploy, with the password`;
const CEILING = `${WAITED} fails at its ceiling, naming the last check the old code made`;
const PASSWORD = `${VERIFY} › verifyDev > never puts the password in a problem`;

const GATE = '        return Number.isFinite(check) && check < deployedAtMs\n';

export default mutationFile({
  targets: [VERIFY],
  mutations: [
    {
      name: 'old-code-record-judged',
      file: 'scripts/verify-dev.ts',
      anchor: GATE,
      replacement: '        return false\n',
      red: {
        [BEFORE]: 'to deeply equal',
        [WAITS]: 'to be 3',
        [CEILING]: 'to deeply equal',
        [PASSWORD]: 'to have a length of 2',
      },
    },
    {
      name: 'deploy-millisecond-refused',
      file: 'scripts/verify-dev.ts',
      anchor: GATE,
      replacement:
        '        return Number.isFinite(check) && check <= deployedAtMs\n',
      red: {
        [`${JUDGED} judges a check made at the deploy’s own millisecond as today`]:
          'to deeply equal',
      },
    },
    {
      name: 'unreadable-time-called-before',
      file: 'scripts/verify-dev.ts',
      anchor: GATE,
      replacement: '        return !(check >= deployedAtMs)\n',
      red: {
        [`${JUDGED} leaves a last check that is not a time to the check-age check`]:
          'to deeply equal',
        [`${JUDGED} fails a check that never ran`]: 'to deeply equal',
      },
    },
    {
      name: 'stale-record-not-a-gate',
      file: 'scripts/verify-dev.ts',
      anchor: '      name: AFTER_DEPLOY,\n      gate: true,\n',
      replacement: '      name: AFTER_DEPLOY,\n',
      red: {
        [BEFORE]: 'to deeply equal',
        [WAITS]: 'to deeply equal',
        [CEILING]: 'to deeply equal',
        [PASSWORD]: 'to have a length of 2',
      },
    },
    {
      // The side agent's case: the deployed code's first read fails, and
      // #693 would wait for a second.
      name: 'first-failure-forgiven',
      file: 'scripts/verify-dev.ts',
      anchor: '        body.readFailingSince === null\n',
      replacement:
        '        body.readFailingSince === null ||\n        body.readFailingSince === body.lastCheckAt\n',
      red: {
        [`${JUDGED} fails a read that failed at the last check, the first after the deploy, with the reason`]:
          'to deeply equal',
      },
    },
    {
      name: 'ceiling-drops-the-last-check',
      file: 'scripts/verify-dev.ts',
      anchor: '    ...previous,\n',
      replacement: '',
      red: {
        [CEILING]: 'to deeply equal',
        [PASSWORD]: 'to have a length of 2',
      },
    },
    {
      name: 'unreadable-deploy-time-accepted',
      file: 'scripts/verify-dev.ts',
      anchor:
        '  if (!Number.isFinite(deployedAtMs))\n    throw new RangeError(\n      `the deploy time must be a time, got ${String(deployedAtMs)}`,\n    );\n',
      replacement: '',
      red: {
        [`${WAITED} refuses a deploy time that is not a time`]:
          'instead of rejecting',
      },
    },
  ],
});
