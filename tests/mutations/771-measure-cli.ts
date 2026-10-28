import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage CLI as the record's coverage job runs it (#771 AC4): given
 * the rehearsal folder, `measure` stops before any suite runs when the
 * manifest is missing. Predicted before the first run. The row drops the
 * folder Measure was given, so the CLI goes on to run the suites. This is
 * an integration target, so it runs in the pull request's mutations job,
 * never on the laptop (global rule).
 */

const CLI = 'tests/integration/coverage-cli.test.ts';

export default mutationFile({
  targets: [CLI],
  mutations: [
    {
      name: 'measure-ignores-the-rehearsal',
      file: 'scripts/coverage.ts',
      anchor: '  checkRehearsal(rehearsal, readOrUndefined, head, die);\n',
      replacement: '  checkRehearsal(undefined, readOrUndefined, head, die);\n',
      red: {
        [`${CLI} › the coverage CLI (#728) > refuses to measure without the rehearsal it was pointed at, before any suite runs (#771)`]:
          'to deeply equal',
      },
    },
  ],
});
