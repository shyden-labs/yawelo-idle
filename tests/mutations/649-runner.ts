import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The runner's new controls (#649, spec §10), each predicted before its
 * first run: names from the repository root, the project in a Playwright
 * name, colour codes removed, a flaky test failing, a spec that does not
 * parse named by its file, a failed build, the laptop listing the unit suite
 * only, the build pinned to each suite's script, and the mutations
 * workflow's file names. Unit-suite mutations: they run on the laptop too.
 */

const REPORTER = 'tests/unit/mutate-reporter.test.ts';
const PW = 'tests/unit/mutate-playwright.test.ts';
const RECORDED = `${PW} › readPlaywrightReport, on recorded runs >`;
const SHAPES = `${PW} › readPlaywrightReport, on the shapes it reads >`;
const RUN = 'tests/unit/mutate-run.test.ts';
const BUILDS = 'tests/unit/mutate-builds.test.ts';
const SCRIPTS = `${BUILDS} › each suite runs as its package script does >`;
const CHANGED = 'tests/unit/mutations-changed.test.ts';
const FILES_IN = `${CHANGED} › mutationFilesIn >`;

export default mutationFile({
  targets: [REPORTER, PW, RUN, BUILDS, CHANGED],
  mutations: [
    {
      name: 'root-ignored',
      file: 'scripts/mutate-reporter.ts',
      anchor: '  return named;\n}',
      replacement: '  return vitestRoot;\n}',
      red: {
        [`${REPORTER} › reportRoot > is the repository root the runner names, when it names one`]:
          '/repo/apps/web',
        [`${REPORTER} › reportRoot > names a harness file from the repository root`]:
          'apps/web/test/game.test.ts',
      },
    },
    {
      name: 'project-dropped',
      file: 'scripts/mutate.ts',
      anchor: "[test.projectName, ...titles, spec.title].join(' > ')",
      replacement: "[...titles, spec.title].join(' > ')",
      red: {
        [`${RECORDED} names a failed test once per project, with its file and project`]:
          'chromium',
        [`${RECORDED} names a test that timed out, and counts it failing`]:
          'chromium',
        [`${SHAPES} names every describe between the project and the title`]:
          'webkit',
        [`${SHAPES} counts a flaky test failing: the runner allows no retry`]:
          'webkit',
        [`${SHAPES} refuses a test whose status it does not know`]:
          'webkit > reads',
        [`${RUN} › runFile in a Playwright suite (CI) > judges the run through Playwright’s report`]:
          'matched',
      },
    },
    {
      name: 'colour-kept',
      file: 'scripts/mutate.ts',
      anchor: ".replace(ANSI, '')",
      replacement: '.replace(ANSI, (code) => code)',
      red: {
        [`${RECORDED} removes the colour codes Playwright writes even with FORCE_COLOR=0`]:
          'shell.spec.ts',
        [`${RECORDED} removes forced colour codes from every failure`]:
          'golden-vectors.spec.ts',
      },
    },
    {
      name: 'flaky-passed',
      file: 'scripts/mutate.ts',
      anchor:
        "if (test.status !== 'unexpected' && test.status !== 'flaky') continue;",
      replacement: "if (test.status !== 'unexpected') continue;",
      red: {
        [`${SHAPES} counts a flaky test failing: the runner allows no retry`]:
          'webkit > reads',
      },
    },
    {
      name: 'location-ignored',
      file: 'scripts/mutate.ts',
      anchor: "isRecord(location) && typeof location.file === 'string'",
      replacement: "isRecord(location) && typeof location.file === 'number'",
      red: {
        [`${RECORDED} names a spec that does not parse as its file, failing`]:
          '(the file)',
      },
    },
    {
      name: 'build-exit-ignored',
      file: 'scripts/mutate.ts',
      anchor: '  if (outcome.buildExit !== undefined)',
      replacement: '  if (outcome.buildExit === 0)',
      red: {
        [`${RUN} › runFile in a suite that builds first (CI) > misses a row whose build failed, naming the exit status`]:
          'build failed (exit 2)',
        [`${RUN} › runFile in a suite that builds first (CI) > refuses a baseline whose build failed`]:
          'build failed (exit 1)',
      },
    },
    {
      name: 'laptop-lists-all',
      file: 'scripts/mutate.ts',
      anchor: '(io.ci ? suites : suites.filter((s) => s.name === UNIT_SUITE))',
      replacement: '(io.ci ? suites : suites)',
      red: {
        [`${RUN} › runFile > refuses on the laptop a target the unit suite does not list, listing no other suite`]:
          'the laptop runs the unit suite only',
      },
    },
    {
      name: 'npx-kept',
      file: 'scripts/mutate.ts',
      anchor: "mutate.build?.[0] === 'npx'",
      replacement: "mutate.build?.[0] === 'npm'",
      red: {
        [`${BUILDS} › mutateScript > drops npx from a build, as a package script runs local binaries itself`]:
          'vite build',
        [`${BUILDS} › mutateScript > keeps an npm build whole`]:
          'npm run build',
        [`${SCRIPTS} game harness: apps/web/package.json "test"`]: 'vite build',
        [`${SCRIPTS} site harness: apps/site/package.json "test"`]:
          'npm run build:harness',
        [`${SCRIPTS} dev hosts harness: apps/dev-hosts/package.json "test"`]:
          'wrangler pages',
        [`${SCRIPTS} web smoke suite: package.json "test:web"`]:
          'npm run build --workspace',
      },
    },
    {
      name: 'file-name-loose',
      file: 'scripts/mutations-changed.ts',
      anchor: '/^tests\\/mutations\\/[A-Za-z0-9._-]+\\.ts$/',
      replacement: '/^tests\\/mutations\\/[^/]+\\.ts$/',
      red: {
        [`${FILES_IN} refuses a mutation file named with a space`]:
          'to throw an error',
        [`${FILES_IN} refuses a mutation file named with a command substitution`]:
          'to throw an error',
        [`${FILES_IN} refuses a mutation file named with a semicolon`]:
          'to throw an error',
      },
    },
    {
      name: 'deleted-kept',
      file: 'scripts/mutations-changed.ts',
      anchor: "status !== 'D' &&",
      replacement: "status !== 'X' &&",
      red: {
        [`${FILES_IN} leaves out a deleted mutation file`]:
          'tests/mutations/gone.ts',
      },
    },
  ],
});
