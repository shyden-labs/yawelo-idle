import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The judge counts a changed mutation file once (#670), predicted before
 * its first run: with the leave-out dropped, `changedHelpers` keeps the
 * mutation file as a helper too, and only the case that holds one beside a
 * helper sees it. Unit-suite mutation: it runs on the laptop too.
 */

const CHANGED = 'tests/unit/mutations-changed.test.ts';
const HELPERS = `${CHANGED} › changedHelpers > `;

export default mutationFile({
  targets: [CHANGED],
  mutations: [
    {
      name: 'mutation-file-kept-as-helper',
      file: 'scripts/mutations-changed.ts',
      anchor:
        '      .filter(({ path }) => TYPESCRIPT.test(path) && !isMutationFile(path))',
      replacement: '      .filter(({ path }) => TYPESCRIPT.test(path))',
      red: {
        [`${HELPERS}leaves out a mutation file, which is judged as one, never as a helper too (#670)`]:
          'tests/mutations/670-x.ts',
      },
    },
  ],
});
