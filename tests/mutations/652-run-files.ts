import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * `runFiles`' own controls (#652), each predicted before its first run: a
 * refusal from `runFile` that ends the loop, a file that does not load
 * ending it or going uncounted, and a refused file left out of the exit
 * verdict. Unit-suite mutations: they run on the laptop too.
 */

const RUN = 'tests/unit/mutate-run.test.ts';
const FILES = `${RUN} › runFiles >`;

export default mutationFile({
  targets: [RUN],
  mutations: [
    {
      name: 'refusal-ends-the-loop',
      file: 'scripts/mutate.ts',
      anchor: '      if (!(error instanceof Refusal)) throw error;',
      replacement: '      throw error;',
      red: {
        [`${FILES} prints a refused file, counts it, and still runs the next file`]:
          'tests/mutations/a.ts: names no targets',
        [`${FILES} refuses every file, running no suite, and fails`]:
          'tests/mutations/b.ts: names no targets',
      },
    },
    {
      name: 'load-failure-ends-the-loop',
      file: 'scripts/mutate.ts',
      anchor:
        '        `REFUSED ${path}: ${error instanceof Error ? error.message : String(error)}`,\n      );\n      continue;',
      replacement:
        '        `REFUSED ${path}: ${error instanceof Error ? error.message : String(error)}`,\n      );\n      break;',
      // Corrected after the first run (hindsight): every predicted test went
      // red, but vitest's message cuts each string it compares after 37
      // characters. The row after it is its sibling, predicted before its
      // first run.
      red: {
        [`${FILES} refuses a file whose module fails to load, naming it, and runs the next`]:
          "expected 'mutate: 0 of 0 rows matched; 1 of 2 f…' to be 'mutate: 1 of 1 rows matched; 1 of 2 f…'",
        [`${FILES} refuses a module that does not export a mutation file, and runs the next`]:
          "expected 'mutate: 0 of 0 rows matched; 1 of 2 f…' to be 'mutate: 1 of 1 rows matched; 1 of 2 f…'",
        [`${FILES} refuses every file, running no suite, and fails`]:
          'to deeply equal',
      },
    },
    {
      name: 'load-failure-uncounted',
      file: 'scripts/mutate.ts',
      anchor:
        '      refused += 1;\n      io.print(\n        `REFUSED ${path}: ${error instanceof Error',
      replacement:
        '      io.print(\n        `REFUSED ${path}: ${error instanceof Error',
      red: {
        [`${FILES} refuses a file whose module fails to load, naming it, and runs the next`]:
          "expected 'mutate: 1 of 1 rows matched; 0 of 2 f…' to be 'mutate: 1 of 1 rows matched; 1 of 2 f…'",
        [`${FILES} refuses a module that does not export a mutation file, and runs the next`]:
          "expected 'mutate: 1 of 1 rows matched; 0 of 2 f…' to be 'mutate: 1 of 1 rows matched; 1 of 2 f…'",
        [`${FILES} refuses every file, running no suite, and fails`]:
          'to deeply equal',
      },
    },
    {
      name: 'refusals-pass-the-exit',
      file: 'scripts/mutate.ts',
      anchor: 'ok: matched === rows && refused === 0',
      replacement: 'ok: matched === rows',
      red: {
        [`${FILES} prints a refused file, counts it, and still runs the next file`]:
          'expected true to be false',
        [`${FILES} refuses a file whose module fails to load, naming it, and runs the next`]:
          'expected true to be false',
        [`${FILES} refuses every file, running no suite, and fails`]:
          'expected true to be false',
      },
    },
  ],
});
