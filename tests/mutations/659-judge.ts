import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The changed-helper judge (#659), each row predicted before its first run:
 * which paths sit in a test folder, which changed files count as helpers,
 * data or recorded counts, which rows plant in which file, when a helper
 * counts as proved, how a failure names the tests that use it, the
 * summary's helper count, which tests load each helper, and which tests
 * name each data file. Unit-suite mutations: they run on the laptop too.
 *
 * Not mutated: the walk's cycle check in `reaches`. Without it a cycle loops
 * for ever, and a synchronous loop hangs the run past every timeout.
 */

const CHANGED = 'tests/unit/mutations-changed.test.ts';
const LOADERS = 'tests/unit/helper-modules.test.ts';
const JUDGE = 'scripts/mutations-changed.ts';
const WALKER = 'tests/unit/helper-modules.ts';

const FOLDER = `${CHANGED} › inTestFolder > `;
const HELPERS = `${CHANGED} › changedHelpers > `;
const PLANTED = `${CHANGED} › redByPlantedFile > `;
const UNPROVED = `${CHANGED} › unprovedHelpers > `;
const SUMMARY = `${CHANGED} › summary > `;
const LOADED_BY = `${LOADERS} › helperLoaders maps each helper to the entries that load it (#659) > `;
const READ_BY = `${LOADERS} › dataReaders maps each data file to the entries whose code names it (#659) > `;

const KEEPS = `${HELPERS}keeps each TypeScript file added, changed or renamed in a test folder that no suite lists, in diff order`;
const DELETED = `${HELPERS}leaves out a deleted one`;
const LISTED = `${HELPERS}leaves out a test any suite lists, the unit suite’s included`;
const OUTSIDE = `${HELPERS}leaves out a file outside the test folders`;
const DATA = `${HELPERS}keeps each other file in a test folder as data, which a test may read rather than import, leaving out a deleted one`;
const RECORDED = `${HELPERS}lists apart, and judges no further, the recorded-count files CI writes (Shyden, 2026-10-18)`;
const javascript = (path: string): string =>
  `${HELPERS}refuses by name a JavaScript file in a test folder, ${path}, which the follower does not read`;
const named = (how: string): string => `${READ_BY}named in the test by ${how}`;
const unnamed = (how: string): string =>
  `${READ_BY}not named by ${how}, beside a test that names it`;

const STAYS_FALSE = 'expected false to be true';
const BECOMES_TRUE = 'expected true to be false';
const FLOORS_UNPROVED = 'tests/floors.ts: loaded by 1 non-unit test';
const FILE = 'a JavaScript file in a test folder';
const READER = 't/a.test.ts';

const FOLDER_AND_EXTENSION = [
  'its folder written from the root with ./, and its extension',
  'its folder, up a folder, and its extension, written apart',
  'its folder with a trailing slash and its extension, written apart',
  'its folder and its extension, written apart',
];

export default mutationFile({
  targets: [CHANGED, LOADERS],
  mutations: [
    {
      name: 'root-tests-folder-dropped',
      file: JUDGE,
      anchor: "    parts[0] === 'tests' ||\n",
      replacement: '',
      red: {
        [`${FOLDER}holds tests/searched.ts`]: STAYS_FALSE,
        [`${FOLDER}holds tests/unit/helper-modules.ts`]: STAYS_FALSE,
        [KEEPS]: 'tests/searched.ts',
        [DELETED]: 'tests/floors.ts',
        [LISTED]: 'tests/floors.ts',
        [OUTSIDE]: 'tests/floors.ts',
        [DATA]: 'tests/fixtures/data.json',
        [RECORDED]: 'tests/floors/web-smoke.json',
        [javascript('tests/h.js')]: FILE,
        [javascript('tests/unit/h.cjs')]: FILE,
      },
    },
    {
      name: 'workspace-folders-dropped',
      file: JUDGE,
      anchor:
        '        parent.every((part, i) => parts[i] === part) && testFolderAt(folder),',
      replacement: '        false,',
      red: {
        [`${FOLDER}holds packages/core/test/sim-laws.ts`]: STAYS_FALSE,
        [`${FOLDER}holds apps/site/test/roadmap/fake.ts`]: STAYS_FALSE,
        [`${FOLDER}holds apps/web/tests/h.ts`]: STAYS_FALSE,
        [`${FOLDER}reads a workspace folder package.json names without a wildcard`]:
          STAYS_FALSE,
        [KEEPS]: 'packages/core/test/sim.mts',
        [DATA]: 'packages/core/test/README.md',
        [javascript('packages/core/test/h.mjs')]: FILE,
      },
    },
    {
      name: 'workspace-prefix-ignored',
      file: JUDGE,
      anchor:
        'parent.every((part, i) => parts[i] === part) && testFolderAt(folder)',
      replacement: 'testFolderAt(folder)',
      red: {
        [`${FOLDER}leaves out docs/guide/test/x.ts, a test/ folder as deep as a workspace’s`]:
          BECOMES_TRUE,
      },
    },
    {
      name: 'test-folder-name-dropped',
      file: JUDGE,
      anchor: "    parts[folder] === 'test' || parts[folder] === 'tests';",
      replacement: "    parts[folder] === 'tests';",
      red: {
        [`${FOLDER}holds packages/core/test/sim-laws.ts`]: STAYS_FALSE,
        [`${FOLDER}holds apps/site/test/roadmap/fake.ts`]: STAYS_FALSE,
        [`${FOLDER}reads a workspace folder package.json names without a wildcard`]:
          STAYS_FALSE,
        [KEEPS]: 'packages/core/test/sim.mts',
        [DATA]: 'packages/core/test/README.md',
        [javascript('packages/core/test/h.mjs')]: FILE,
      },
    },
    {
      name: 'wildcard-ignored',
      file: JUDGE,
      anchor:
        '    return { parent, folder: parent.length + (wildcard ? 1 : 0) };',
      replacement: '    return { parent, folder: parent.length };',
      red: {
        [`${FOLDER}holds packages/core/test/sim-laws.ts`]: STAYS_FALSE,
        [`${FOLDER}holds apps/site/test/roadmap/fake.ts`]: STAYS_FALSE,
        [`${FOLDER}holds apps/web/tests/h.ts`]: STAYS_FALSE,
        [KEEPS]: 'packages/core/test/sim.mts',
        [DATA]: 'packages/core/test/README.md',
        [javascript('packages/core/test/h.mjs')]: FILE,
      },
    },
    {
      name: 'bad-workspace-accepted',
      file: JUDGE,
      anchor:
        '    if (parent.some((part) => !/^[A-Za-z0-9._-]+$/.test(part)))\n',
      replacement: '    if (false)\n',
      red: {
        [`${FOLDER}refuses a workspace pattern it cannot read`]:
          'to throw an error',
      },
    },
    {
      name: 'listed-test-kept',
      file: JUDGE,
      anchor:
        "      status !== 'D' && !listed.has(path) && inTestFolder(path, workspaces),",
      replacement: "      status !== 'D' && inTestFolder(path, workspaces),",
      red: { [LISTED]: 'tests/unit/a.test.ts' },
    },
    {
      name: 'deleted-helper-kept',
      file: JUDGE,
      anchor:
        "      status !== 'D' && !listed.has(path) && inTestFolder(path, workspaces),",
      replacement: '      !listed.has(path) && inTestFolder(path, workspaces),',
      red: { [DELETED]: 'tests/gone.ts', [DATA]: 'tests/fixtures/gone.json' },
    },
    {
      name: 'test-folder-unchecked',
      file: JUDGE,
      anchor:
        "      status !== 'D' && !listed.has(path) && inTestFolder(path, workspaces),",
      replacement: "      status !== 'D' && !listed.has(path),",
      red: { [OUTSIDE]: 'scripts/mutate.ts' },
    },
    {
      name: 'javascript-unrefused',
      file: JUDGE,
      anchor: '      .filter(({ path }) => JAVASCRIPT.test(path))',
      replacement: '      .filter(() => false)',
      red: {
        [javascript('tests/h.js')]: FILE,
        [javascript('packages/core/test/h.mjs')]: FILE,
        [javascript('tests/unit/h.cjs')]: FILE,
      },
    },
    {
      name: 'non-typescript-kept',
      file: JUDGE,
      anchor: '      .filter(({ path }) => TYPESCRIPT.test(path))\n',
      replacement: '',
      red: {
        [DATA]: 'tests/fixtures/data.json',
        [RECORDED]: 'tests/floors-old/x.json',
        [javascript('tests/h.js')]: 'tests/h.js',
        [javascript('packages/core/test/h.mjs')]: 'packages/core/test/h.mjs',
        [javascript('tests/unit/h.cjs')]: 'tests/unit/h.cjs',
      },
    },
    {
      name: 'javascript-read-as-data',
      file: JUDGE,
      anchor: ' && !JAVASCRIPT.test(path)',
      replacement: '',
      red: {
        [javascript('tests/h.js')]: FILE,
        [javascript('packages/core/test/h.mjs')]: FILE,
        [javascript('tests/unit/h.cjs')]: FILE,
      },
    },
    {
      name: 'typescript-read-as-data',
      file: JUDGE,
      anchor: '!TYPESCRIPT.test(path) && !JAVASCRIPT.test(path)',
      replacement: '!JAVASCRIPT.test(path)',
      red: {
        [KEEPS]: 'tests/searched.ts',
        [OUTSIDE]: 'tests/floors.ts',
        [DATA]: 'tests/floors.ts',
        [RECORDED]: 'tests/floors.ts',
      },
    },
    {
      name: 'recorded-judged',
      file: JUDGE,
      anchor: '    recorded.some((folder) => path.startsWith(`${folder}/`));',
      replacement: '    false;',
      red: { [RECORDED]: 'tests/minimums/core-sim.json' },
    },
    {
      name: 'recorded-boundary-loose',
      file: JUDGE,
      anchor: 'path.startsWith(`${folder}/`)',
      replacement: 'path.startsWith(folder)',
      // Corrected after its first run: tests/floors.ts, a helper, starts
      // with tests/floors too, so every case that keeps it reads it as
      // recorded. The boundary exists for exactly that neighbour.
      red: {
        [RECORDED]: 'tests/floors-old/x.json',
        [DELETED]: 'tests/floors.ts',
        [LISTED]: 'tests/floors.ts',
        [OUTSIDE]: 'tests/floors.ts',
        [DATA]: 'tests/floors.ts',
      },
    },
    {
      name: 'planted-file-ignored',
      file: JUDGE,
      anchor:
        '        const tests = red.get(row.file) ?? new Set<string>();\n        tests.add(redTestFile(key));\n        red.set(row.file, tests);',
      replacement:
        '        const tests = red.get(redTestFile(key)) ?? new Set<string>();\n        tests.add(redTestFile(key));\n        red.set(redTestFile(key), tests);',
      red: {
        [`${PLANTED}maps each file a row plants in to the test files its rows predict red, across mutation files`]:
          'tests/searched.ts',
        [`${PLANTED}leaves out a file whose every row is predicted green`]:
          'tests/floors.ts',
      },
    },
    {
      name: 'whole-key-planted',
      file: JUDGE,
      anchor: '        tests.add(redTestFile(key));',
      replacement: '        tests.add(key);',
      red: {
        [`${PLANTED}maps each file a row plants in to the test files its rows predict red, across mutation files`]:
          'tests/guards/a.test.ts › d > t',
        [`${PLANTED}leaves out a file whose every row is predicted green`]:
          'tests/guards/a.test.ts › d > t',
      },
    },
    {
      name: 'unloaded-helper-demanded',
      file: JUDGE,
      anchor:
        '    if (loaders.length === 0 || loaders.some((test) => red?.has(test)))',
      replacement: '    if (loaders.some((test) => red?.has(test)))',
      red: {
        [`${UNPROVED}passes a changed helper no non-unit test loads`]:
          'tests/unit/only-unit.ts',
      },
    },
    {
      name: 'any-red-row-proves',
      file: JUDGE,
      anchor:
        '    if (loaders.length === 0 || loaders.some((test) => red?.has(test)))',
      replacement: '    if (loaders.length === 0 || red !== undefined)',
      red: {
        [`${UNPROVED}fails a helper whose rows predict red only tests that do not load it`]:
          FLOORS_UNPROVED,
      },
    },
    {
      name: 'any-planted-file-proves',
      file: JUDGE,
      anchor:
        '    if (loaders.length === 0 || loaders.some((test) => red?.has(test)))',
      replacement: '    if (loaders.length === 0 || planted.size > 0)',
      red: {
        [`${UNPROVED}passes a helper a row plants in and predicts red for one test that loads it`]:
          FLOORS_UNPROVED,
        [`${UNPROVED}fails a helper whose rows predict red only tests that do not load it`]:
          FLOORS_UNPROVED,
        [`${UNPROVED}fails a helper when the row predicting its loader red plants in another file`]:
          FLOORS_UNPROVED,
      },
    },
    {
      name: 'every-loader-named',
      file: JUDGE,
      anchor: 'loaders.slice(0, NAMED_LOADERS).join',
      replacement: 'loaders.join',
      red: {
        [`${UNPROVED}names the first five tests that load it, and how many more`]:
          'and 2 more',
      },
    },
    {
      name: 'five-says-more',
      file: JUDGE,
      anchor: '      loaders.length > NAMED_LOADERS',
      replacement: '      loaders.length >= NAMED_LOADERS',
      red: {
        [`${UNPROVED}names all five tests that load it when there are five`]:
          'and 0 more',
      },
    },
    {
      name: 'helpers-uncounted',
      file: JUDGE,
      anchor: "${counted(counts.helpers, 'helper', 'helpers')} and ",
      replacement: '0 helpers and ',
      red: {
        [`${SUMMARY}says how many non-unit tests, helpers and mutation files changed of how many paths it judged`]:
          '2 helpers',
        [`${SUMMARY}names one helper in the singular`]: '1 helper and',
      },
    },
    {
      name: 'unit-loaders-kept',
      file: JUDGE,
      anchor: '        loaders.filter((test) => nonUnit.has(test)),\n',
      replacement: '        [...loaders],\n',
      red: {
        [`${CHANGED} › nonUnitLoaders > keeps only the non-unit tests among each file’s loaders, leaving out a file only unit tests load`]:
          'tests/unit/u.test.ts',
      },
    },
    {
      name: 'unit-only-file-kept',
      file: JUDGE,
      anchor: '      .filter(([, loaders]) => loaders.length > 0),\n',
      replacement: '',
      red: {
        [`${CHANGED} › nonUnitLoaders > keeps only the non-unit tests among each file’s loaders, leaving out a file only unit tests load`]:
          'tests/unit/only-unit.ts',
      },
    },
    {
      name: 'unnamed-data-passes',
      file: JUDGE,
      anchor: '    .filter((path) => (readBy.get(path) ?? []).length === 0)',
      replacement: '    .filter(() => false)',
      red: {
        [`${CHANGED} › unnamedData > names each changed data file that no test, nor a helper one loads, names, and passes one any test names, a unit test’s included`]:
          'tests/z.json',
      },
    },
    {
      name: 'loads-not-recorded',
      file: WALKER,
      anchor: '      direct.push(target);\n',
      replacement: '',
      red: {
        [`${LOADED_BY}directly`]: 't/h.ts',
        [`${LOADED_BY}through other helpers, to any depth`]: 't/h3.ts',
        [`${LOADED_BY}naming every entry that reaches it, sorted, and no entry that does not`]:
          't/h2.ts',
        [`${LOADED_BY}once each, through a cycle entered at either end`]:
          't/h1.ts',
        [`${READ_BY}named in a helper the test loads, at any depth`]: READER,
        [`${READ_BY}naming every entry that names it, sorted`]: READER,
      },
    },
    {
      name: 'loaders-direct-only',
      file: WALKER,
      anchor: '        stack.push(...(loads.get(file) ?? []));\n',
      replacement: '',
      red: {
        [`${LOADED_BY}through other helpers, to any depth`]: 't/h3.ts',
        [`${LOADED_BY}naming every entry that reaches it, sorted, and no entry that does not`]:
          't/h2.ts',
        [`${LOADED_BY}once each, through a cycle entered at either end`]:
          't/h1.ts',
        [`${READ_BY}named in a helper the test loads, at any depth`]: READER,
      },
    },
    {
      name: 'loaders-unsorted',
      file: WALKER,
      anchor: '    [...entries].sort().map((entry) => {',
      replacement: '    entries.map((entry) => {',
      red: {
        [`${LOADED_BY}naming every entry that reaches it, sorted, and no entry that does not`]:
          't/b.test.ts',
        [`${READ_BY}naming every entry that names it, sorted`]: 't/b.test.ts',
      },
    },
    {
      name: 'templates-ignored',
      file: WALKER,
      anchor: '    if (ts.isTemplateExpression(node))',
      replacement: '    if (false)',
      red: {
        [named('a template whose substitution stands for any text')]: READER,
        [named('a relative template up a folder that resolves to its folder')]:
          READER,
        ...Object.fromEntries(
          FOLDER_AND_EXTENSION.map((how) => [named(how), READER]),
        ),
      },
    },
    {
      name: 'template-slash-after-substitution',
      file: WALKER,
      anchor:
        "    (rest.some((part) => part.includes('/')) ||\n      !head.includes('/') ||",
      replacement: "    (!head.includes('/') ||",
      red: {
        [unnamed('a template whose folder is partly built at run time')]:
          READER,
      },
    },
    {
      name: 'template-folder-unpinned',
      file: WALKER,
      anchor: "      !head.includes('/') ||\n",
      replacement: '',
      // Corrected after its first run: the case naming another folder also
      // writes `${name}.json`, which then names any JSON file by itself.
      red: {
        [unnamed('a template with no folder, which could name any such file')]:
          READER,
        [unnamed('another folder with its extension')]: READER,
      },
    },
    {
      name: 'template-extension-unchecked',
      file: WALKER,
      anchor: '      !last.endsWith(posix.extname(data)))',
      replacement: '      false)',
      red: { [unnamed('a template that fixes no extension')]: READER },
    },
    {
      name: 'relative-unresolved',
      file: WALKER,
      anchor: "  if (head.startsWith('.')) {",
      replacement: '  if (false) {',
      // The relative template still names it by its folder (namesFolder).
      red: {
        [named('a relative path up a folder that resolves to it')]: READER,
      },
    },
    {
      name: 'root-relative-unstripped',
      file: WALKER,
      anchor: "  const stripped = head.replace(/^(\\.\\/)+/, '');",
      replacement: '  const stripped = head;',
      red: {
        [named('its repository path written from the root with ./')]: READER,
      },
    },
    {
      name: 'suffix-unanchored',
      file: WALKER,
      anchor: 'new RegExp(`^(.*/)?${pattern(stripped)}$`)',
      replacement: 'new RegExp(`${pattern(stripped)}$`)',
      red: {
        [unnamed('a path that ends like it but not on a folder boundary')]:
          READER,
      },
    },
    {
      name: 'basename-unanchored',
      file: WALKER,
      anchor: 'new RegExp(`^${pattern(stripped)}$`).test(posix.basename(data))',
      replacement: 'new RegExp(pattern(stripped)).test(posix.basename(data))',
      red: { [unnamed('its extension alone')]: READER },
    },
    {
      name: 'folder-rule-dropped',
      file: WALKER,
      anchor:
        '            written.some((parts) => names(file, parts, target)) ||\n            namesFolder(file, written, target)',
      replacement:
        '            written.some((parts) => names(file, parts, target))',
      red: Object.fromEntries(
        FOLDER_AND_EXTENSION.map((how) => [named(how), READER]),
      ),
    },
    {
      name: 'folder-extension-unchecked',
      file: WALKER,
      anchor:
        "    strings.some((written) => (written.at(-1) ?? '').endsWith(extension))",
      replacement: '    true',
      red: {
        [unnamed('its folder with another extension')]: READER,
        [unnamed('a template of another kind of file')]: READER,
        [unnamed('a template that fixes no extension')]: READER,
      },
    },
    {
      name: 'folder-first-segment-only',
      file: WALKER,
      anchor: "      path.replace(/^(\\.\\/)+/, '') === folder ||",
      replacement: "      path.split('/')[0] === folder.split('/')[0] ||",
      red: {
        [unnamed('another folder with its extension')]: READER,
        [unnamed('a template that resolves elsewhere')]: READER,
        [unnamed('a template whose folder is partly built at run time')]:
          READER,
        [named('its folder written from the root with ./, and its extension')]:
          READER,
      },
    },
    {
      name: 'folder-root-unstripped',
      file: WALKER,
      anchor: "      path.replace(/^(\\.\\/)+/, '') === folder ||",
      replacement: '      path === folder ||',
      red: {
        [named('its folder written from the root with ./, and its extension')]:
          READER,
      },
    },
    {
      name: 'folder-relative-unresolved',
      file: WALKER,
      anchor:
        "      (path.startsWith('.') && posix.join(posix.dirname(file), path) === folder)",
      replacement: '      false',
      red: {
        [named('its folder, up a folder, and its extension, written apart')]:
          READER,
      },
    },
    {
      name: 'folder-slash-kept',
      file: WALKER,
      anchor: "    const path = text.replace(/\\/+$/, '');",
      replacement: '    const path = text;',
      red: {
        [named(
          'its folder with a trailing slash and its extension, written apart',
        )]: READER,
      },
    },
  ],
});
