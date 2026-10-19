import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #374 in the integration suite (judge rule #659): againstControl handing
 * back the control's result turns the empty commit's check red. Predicted
 * before it first ran (2026-10-19).
 */
export default mutationFile({
  targets: ['tests/integration/ci-scope.test.ts'],
  mutations: [
    {
      name: 'I1-control-returns-the-control',
      file: 'tests/searched.ts',
      anchor: '  return run(input);\n}',
      replacement: '  return run(control);\n}',
      red: {
        'tests/integration/ci-scope.test.ts › real commits read against their first parent (AC1, AC4) > a commit changing nothing is full (an empty diff)':
          'docs/b.md',
      },
    },
  ],
});
