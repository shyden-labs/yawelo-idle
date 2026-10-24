import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * floors:fetch writes the floors and the coverage record as one change
 * (#747), in the unit suite. Predicted before the first run (2026-10-22
 * UTC). Each row breaks one behaviour of writeFetched (or the writer
 * writeFloors takes from it), never a test, and names every unit test that
 * goes red.
 */

const FETCH = 'tests/unit/fetch-floors.test.ts';
const W = `${FETCH} › writeFetched (#747) >`;
const FIRST = `${W} writes the first coverage record into a folder that does not exist yet`;
const BACK = `${W} puts every floor back, and removes what it made, when the record cannot be written`;
const FLOOR = `${W} puts back a floor a failed write had begun to change`;
const RECORD = `${W} puts back a record a failed write had begun to change`;
const NEW = `${W} removes a new record a failed write had begun`;
const MADE = `${W} removes the floors folder it made when a later write fails`;
const NO_FLOORS = `${W} changes nothing when the floors' folder cannot be made`;
const NO_RECORD = `${W} changes nothing when the record's folder cannot be made`;
// #748: nothing is written while git would leave a target out of the commit.
// Predicted before the first run (2026-10-23 UTC).
const G = `${FETCH} › what git would leave out of the commit (#748) >`;
const TARGETS = `${G} names each floor file the fetch writes once, then the record`;
const REFUSES = `${G} refuses to write while a target is ignored, naming each, and lets through none ignored`;
const FOLDER = `${G} keeps a new file in the coverage record's folder, while coverage tools' output stays ignored`;

export default mutationFile({
  targets: [FETCH],
  mutations: [
    {
      name: 'M1-record-folder-not-made',
      file: 'scripts/fetch-floors.ts',
      anchor:
        '      ...(record === undefined ? [] : [dirname(record.file)]),\n',
      replacement: '',
      red: {
        [FIRST]: 'ENOENT',
        [NO_RECORD]: 'to throw error including',
      },
    },
    {
      name: 'M2-new-floors-left',
      file: 'scripts/fetch-floors.ts',
      anchor: 'rmSync(join(floorsDir, name));',
      replacement: 'void 0;',
      red: {
        [BACK]: 'to deeply equal',
      },
    },
    {
      name: 'M3-changed-text-left',
      file: 'scripts/fetch-floors.ts',
      anchor: 'else if (textOf(file) !== text)',
      replacement: 'else if (false)',
      red: {
        [BACK]: 'to be',
        [FLOOR]: 'to be',
        [RECORD]: 'to be',
      },
    },
    {
      name: 'M4-new-record-left',
      file: 'scripts/fetch-floors.ts',
      anchor: '        if (existsSync(file)) rmSync(file);\n',
      replacement: '        if (existsSync(file)) void 0;\n',
      red: {
        [NEW]: 'to deeply equal',
      },
    },
    {
      name: 'M5-made-folders-left',
      file: 'scripts/fetch-floors.ts',
      anchor: '      rmSync(dir, { recursive: true, force: true });\n',
      replacement: '      void dir;\n',
      red: {
        [BACK]: 'to deeply equal',
        [MADE]: 'to deeply equal',
      },
    },
    {
      name: 'M6-error-not-named',
      file: 'scripts/fetch-floors.ts',
      anchor: 'every file is as it was: ${(error as Error).message}`',
      replacement: 'every file is as it was`',
      red: {
        [BACK]: 'to throw error including',
        [FLOOR]: 'to throw error including',
        [RECORD]: 'to throw error including',
        [NEW]: 'to throw error including',
        [MADE]: 'to throw error including',
        [NO_FLOORS]: 'to throw error including',
        [NO_RECORD]: 'to throw error including',
      },
    },
    {
      name: 'M7-floors-skip-the-writer',
      file: 'scripts/record-floors.ts',
      anchor: '    write(file, text);\n',
      replacement: '    writeFileSync(file, text);\n',
      red: {
        [FLOOR]: 'to throw an error',
      },
    },
    {
      name: 'M8-floors-not-read-first',
      file: 'scripts/fetch-floors.ts',
      anchor:
        '      before.set(join(floorsDir, name), textOf(join(floorsDir, name)));\n',
      replacement: '      void name;\n',
      red: {
        [BACK]: 'to deeply equal',
        [FLOOR]: 'ENOENT',
        [NO_RECORD]: 'ENOENT',
      },
    },
    {
      name: 'M9-record-not-read-first',
      file: 'scripts/fetch-floors.ts',
      anchor:
        '  if (record !== undefined) before.set(record.file, textOf(record.file));\n',
      replacement: '',
      red: {
        [RECORD]: 'to be',
        [NEW]: 'to deeply equal',
      },
    },
    {
      name: 'M10-coverage-folder-ignored-again',
      file: '.gitignore',
      anchor: '!/tests/coverage/\n',
      replacement: '',
      red: { [FOLDER]: 'to deeply equal' },
    },
    {
      name: 'M11-ignored-target-let-through',
      file: 'scripts/fetch-floors.ts',
      anchor: '  const left = targets.filter(ignored);\n',
      replacement: '  const left = targets.filter(() => false);\n',
      red: { [REFUSES]: 'to deeply equal' },
    },
    {
      name: 'M12-record-not-a-target',
      file: 'scripts/fetch-floors.ts',
      anchor: '    ...(recordFile === undefined ? [] : [recordFile]),\n',
      replacement: '',
      red: { [TARGETS]: 'to deeply equal' },
    },
    {
      name: 'M13-floor-files-unsorted',
      file: 'scripts/fetch-floors.ts',
      anchor: '    ...[...floors].sort(),\n',
      replacement: '    ...floors,\n',
      red: { [TARGETS]: 'to deeply equal' },
    },
  ],
});
