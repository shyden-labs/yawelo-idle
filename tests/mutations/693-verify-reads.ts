import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Dev verify's roadmap reads check (#693, Shyden 2026-10-19): a failed read
 * is red only once a later check has failed too, predicted before the first
 * run. Each row puts back one way it could go wrong: the boundary off by
 * one, the old any-failure rule, times it cannot compare read as fine, and
 * the message losing the check it rests on.
 */

const VERIFY = 'tests/unit/verify-dev.test.ts';
const READS = `${VERIFY} › roadmapProblems (#341) >`;
const AT_THE_CHECK = `${READS} passes a read that failed at the last check, until the next check reads again`;
const AFTER_THE_CHECK = `${READS} passes an event read that failed after the last check`;
const UNCOMPARABLE = `${READS} fails a failing read whose time it cannot compare, rather than pass it`;

export default mutationFile({
  targets: [VERIFY],
  mutations: [
    {
      name: 'boundary-off-by-one',
      file: 'scripts/verify-dev.ts',
      anchor:
        '        if (Number.isFinite(since) && Number.isFinite(check) && check <= since)\n',
      replacement:
        '        if (Number.isFinite(since) && Number.isFinite(check) && check < since)\n',
      red: { [AT_THE_CHECK]: 'to deeply equal' },
    },
    {
      name: 'any-failure-red',
      file: 'scripts/verify-dev.ts',
      anchor:
        '        if (Number.isFinite(since) && Number.isFinite(check) && check <= since)\n          return undefined;\n',
      replacement: '',
      red: {
        [AT_THE_CHECK]: 'to deeply equal',
        [AFTER_THE_CHECK]: 'to deeply equal',
      },
    },
    {
      name: 'uncomparable-times-pass',
      file: 'scripts/verify-dev.ts',
      anchor:
        '        if (Number.isFinite(since) && Number.isFinite(check) && check <= since)\n',
      replacement: '        if (!(check > since))\n',
      red: { [UNCOMPARABLE]: 'to deeply equal' },
    },
    {
      name: 'message-drops-the-check',
      file: 'scripts/verify-dev.ts',
      anchor: ', the check at ${stamped(body.lastCheckAt)} included',
      replacement: '',
      red: {
        [`${READS} fails reads still failing at a later check, with the reason`]:
          'to deeply equal',
        [`${READS} fails a read failure one millisecond before the last check`]:
          'to deeply equal',
        [UNCOMPARABLE]: 'to deeply equal',
      },
    },
  ],
});
