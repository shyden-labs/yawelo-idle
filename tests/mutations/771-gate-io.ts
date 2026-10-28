import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The gate's real io adds the environment it is given to the runner's, for
 * one command (#771): the rehearsal turns act's version check off through
 * it, after record run 40723820849 failed on the line that check adds.
 * Predicted before the first run. The rows drop the given environment, and
 * replace the runner's with it. This is an integration target, so it runs
 * in the pull request's mutations job, never on the laptop (global rule).
 */

const IO = 'tests/integration/record-gate-io.test.ts';
const T = `${IO} › the gate’s real io (#771) >`;

export default mutationFile({
  targets: [IO],
  mutations: [
    {
      name: 'given-environment-dropped',
      file: 'scripts/record-gate.ts',
      anchor: '        env: { ...process.env, ...env },\n',
      replacement: '        env: process.env,\n',
      red: {
        [`${T} adds the environment it is given to the runner’s, for that command alone`]:
          'to deeply equal',
      },
    },
    {
      name: 'runner-environment-replaced',
      file: 'scripts/record-gate.ts',
      anchor: '        env: { ...process.env, ...env },\n',
      replacement: '        env: { ...env },\n',
      red: {
        [`${T} adds the environment it is given to the runner’s, for that command alone`]:
          'to deeply equal',
        [`${T} passes the runner’s environment unchanged when given none`]:
          'to deeply equal',
      },
    },
  ],
});
