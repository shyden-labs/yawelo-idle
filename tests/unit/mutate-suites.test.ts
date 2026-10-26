import { describe, expect, it } from 'vitest';
import {
  mutableSuites,
  playwrightArgs,
  playwrightEnv,
  readObservations,
  runEnv,
  vitestArgs,
  type MutableSuite,
  type RunRequest,
} from '../../scripts/mutate.ts';
import { RECORD_ENV, SUITES, type Suite } from '../../scripts/record-floors.ts';
import { REPORT_ENV, ROOT_ENV } from '../../scripts/mutate-reporter.ts';

/**
 * The suites the mutation runner can run (#527, spec §5), and how it runs
 * them: each from its own folder, under its own config, after its build
 * (#649), vitest suites with both reporters naming files from the
 * repository root, recording floors only when asked.
 */

const SUITE: Suite = {
  name: 'guards suite',
  cwd: '.',
  list: ['npx', 'vitest', 'list'],
  files: () => [],
  run: ['npm', 'run', 'test:guards'],
};

describe('mutableSuites', () => {
  it('keeps a suite with a mutate config, under its name', () => {
    expect(
      mutableSuites([
        {
          ...SUITE,
          mutate: { kind: 'vitest', config: 'vitest.guards.config.ts' },
        },
      ]),
    ).toEqual<MutableSuite[]>([
      {
        name: 'guards suite',
        cwd: '.',
        kind: 'vitest',
        config: 'vitest.guards.config.ts',
        build: undefined,
      },
    ]);
  });

  it('keeps a suite run under vitest’s default config', () => {
    expect(
      mutableSuites([
        { ...SUITE, name: 'unit suite', mutate: { kind: 'vitest' } },
      ]),
    ).toEqual<MutableSuite[]>([
      {
        name: 'unit suite',
        cwd: '.',
        kind: 'vitest',
        config: undefined,
        build: undefined,
      },
    ]);
  });

  it('leaves out a suite with no mutate command', () => {
    expect(
      mutableSuites([
        SUITE,
        { ...SUITE, name: 'unit suite', mutate: { kind: 'vitest' } },
      ]).map((s) => s.name),
    ).toEqual(['unit suite']);
  });

  it('keeps a suite that runs from its own folder, with its build', () => {
    expect(
      mutableSuites([
        {
          ...SUITE,
          name: 'game harness',
          cwd: 'apps/web',
          mutate: {
            kind: 'vitest',
            config: 'vitest.harness.config.ts',
            build: ['npx', 'vite', 'build'],
          },
        },
      ]),
    ).toEqual<MutableSuite[]>([
      {
        name: 'game harness',
        cwd: 'apps/web',
        kind: 'vitest',
        config: 'vitest.harness.config.ts',
        build: ['npx', 'vite', 'build'],
      },
    ]);
  });

  it('keeps a Playwright suite as a Playwright suite', () => {
    expect(
      mutableSuites([
        {
          ...SUITE,
          name: 'engines suite',
          mutate: {
            kind: 'playwright',
            config: 'playwright.engines.config.ts',
          },
        },
      ]),
    ).toEqual<MutableSuite[]>([
      {
        name: 'engines suite',
        cwd: '.',
        kind: 'playwright',
        config: 'playwright.engines.config.ts',
        build: undefined,
      },
    ]);
  });

  it('can run every suite package.json runs, each from its folder, under its config, after its build', () => {
    expect(mutableSuites(SUITES)).toEqual<MutableSuite[]>([
      {
        name: 'unit suite',
        cwd: '.',
        kind: 'vitest',
        config: undefined,
        build: undefined,
      },
      {
        name: 'guards suite',
        cwd: '.',
        kind: 'vitest',
        config: 'vitest.guards.config.ts',
        build: undefined,
      },
      {
        name: 'integration suite',
        cwd: '.',
        kind: 'vitest',
        config: 'vitest.integration.config.ts',
        build: undefined,
      },
      {
        name: 'properties suite',
        cwd: '.',
        kind: 'vitest',
        config: 'vitest.properties.config.ts',
        build: undefined,
      },
      {
        name: 'logs suite',
        cwd: '.',
        kind: 'vitest',
        config: 'vitest.logs.config.ts',
        build: undefined,
      },
      {
        name: 'pacing suite',
        cwd: '.',
        kind: 'vitest',
        config: 'vitest.pacing.config.ts',
        build: undefined,
      },
      {
        name: 'game harness',
        cwd: 'apps/web',
        kind: 'vitest',
        config: 'vitest.harness.config.ts',
        build: ['npx', 'vite', 'build'],
      },
      {
        name: 'site harness',
        cwd: 'apps/site',
        kind: 'vitest',
        config: 'vitest.harness.config.ts',
        build: ['npm', 'run', 'build:harness'],
      },
      {
        name: 'dev hosts harness',
        cwd: 'apps/dev-hosts',
        kind: 'vitest',
        config: 'vitest.harness.config.ts',
        build: [
          'npx',
          'wrangler',
          'pages',
          'functions',
          'build',
          '--outdir',
          '.build',
        ],
      },
      {
        name: 'sync Worker harness',
        cwd: 'apps/sync-worker',
        kind: 'vitest',
        config: 'vitest.harness.config.ts',
        build: undefined,
      },
      {
        name: 'engines suite',
        cwd: '.',
        kind: 'playwright',
        config: 'playwright.engines.config.ts',
        build: undefined,
      },
      {
        name: 'web smoke suite',
        cwd: '.',
        kind: 'playwright',
        config: 'playwright.web.config.ts',
        build: ['npm', 'run', 'build', '--workspace', '@yawelo-idle/web'],
      },
    ]);
  });
});

const GUARDS: MutableSuite = {
  name: 'guards suite',
  cwd: '.',
  kind: 'vitest',
  config: 'vitest.guards.config.ts',
  build: undefined,
};
const RUN: RunRequest = {
  suite: GUARDS,
  json: '.mutations/x/blind.json',
  log: '.mutations/x/blind.log',
};

const REPORTER = '/runner/scripts/mutate-reporter.ts';

describe('vitestArgs', () => {
  it('runs the whole suite under its config, with the default and the runner’s reporters', () => {
    expect(vitestArgs(RUN, REPORTER)).toEqual([
      'vitest',
      'run',
      '-c',
      'vitest.guards.config.ts',
      '--reporter=default',
      `--reporter=${REPORTER}`,
    ]);
  });

  it('names no config for a suite under vitest’s default', () => {
    expect(
      vitestArgs(
        { ...RUN, suite: { ...GUARDS, name: 'unit suite', config: undefined } },
        REPORTER,
      ),
    ).toEqual([
      'vitest',
      'run',
      '--reporter=default',
      `--reporter=${REPORTER}`,
    ]);
  });

  it('lists the files importing a file, matching no test name', () => {
    expect(
      vitestArgs({ ...RUN, related: 'src/reader.ts' }, REPORTER).slice(0, 6),
    ).toEqual(['vitest', 'related', 'src/reader.ts', '--run', '-t', '^$']);
  });
});

describe('runEnv', () => {
  it('names the report file for the runner’s reporter', () => {
    expect(runEnv({ PATH: '/bin' }, RUN, '/repo')).toEqual({
      PATH: '/bin',
      [REPORT_ENV]: '/repo/.mutations/x/blind.json',
      [ROOT_ENV]: '/repo',
    });
  });

  it('records floors to the requested file', () => {
    expect(
      runEnv(
        { PATH: '/bin' },
        { ...RUN, recordTo: '.mutations/x/o.jsonl' },
        '/repo',
      ),
    ).toEqual({
      PATH: '/bin',
      [REPORT_ENV]: '/repo/.mutations/x/blind.json',
      [ROOT_ENV]: '/repo',
      [RECORD_ENV]: '/repo/.mutations/x/o.jsonl',
    });
  });

  it('drops a recording the caller inherited, so a judged run fails on floors', () => {
    expect(
      runEnv({ PATH: '/bin', [RECORD_ENV]: '/tmp/x' }, RUN, '/repo'),
    ).toEqual({
      PATH: '/bin',
      [REPORT_ENV]: '/repo/.mutations/x/blind.json',
      [ROOT_ENV]: '/repo',
    });
  });
});

const SMOKE: RunRequest = {
  suite: {
    name: 'web smoke suite',
    cwd: '.',
    kind: 'playwright',
    config: 'playwright.web.config.ts',
    build: undefined,
  },
  json: '.mutations/x/blind.json',
  log: '.mutations/x/blind.log',
};

describe('playwrightArgs', () => {
  it('runs the whole suite under its config, listing for people and writing JSON for the runner', () => {
    expect(playwrightArgs(SMOKE)).toEqual([
      'playwright',
      'test',
      '-c',
      'playwright.web.config.ts',
      '--reporter=list,json',
    ]);
  });

  it('refuses a Playwright suite with no config', () => {
    expect(() =>
      playwrightArgs({
        ...SMOKE,
        suite: { ...SMOKE.suite, config: undefined },
      }),
    ).toThrow('web smoke suite names no Playwright config');
  });

  it('refuses a floor record or an importer listing, which only the guards suite takes', () => {
    expect(() => playwrightArgs({ ...SMOKE, related: 'src/a.ts' })).toThrow(
      'web smoke suite: only the guards suite records floors or lists importers',
    );
  });
});

describe('playwrightEnv', () => {
  it('names the file Playwright writes its JSON report to', () => {
    expect(playwrightEnv({ PATH: '/bin' }, SMOKE, '/repo')).toEqual({
      PATH: '/bin',
      PLAYWRIGHT_JSON_OUTPUT_FILE: '/repo/.mutations/x/blind.json',
    });
  });

  it('drops a floor recording the caller inherited', () => {
    expect(
      playwrightEnv({ PATH: '/bin', [RECORD_ENV]: '/tmp/x' }, SMOKE, '/repo'),
    ).toEqual({
      PATH: '/bin',
      PLAYWRIGHT_JSON_OUTPUT_FILE: '/repo/.mutations/x/blind.json',
    });
  });
});

describe('readObservations', () => {
  it('reads one floor check a line', () => {
    expect(
      readObservations(
        '{"id":"a/b","actual":3,"site":"tests/guards/a.test.ts:9"}\n{"id":"c","actual":0,"site":"x.ts:1"}\n',
        'o.jsonl',
      ),
    ).toEqual([
      { id: 'a/b', actual: 3, site: 'tests/guards/a.test.ts:9' },
      { id: 'c', actual: 0, site: 'x.ts:1' },
    ]);
  });

  it('refuses a record that holds nothing', () => {
    expect(() => readObservations('', 'o.jsonl')).toThrow(
      'no floor check was recorded to o.jsonl',
    );
  });

  it('refuses a line that is not a floor check', () => {
    expect(() =>
      readObservations('{"id":"a","actual":-1,"site":"x.ts:1"}\n', 'o.jsonl'),
    ).toThrow(
      'o.jsonl holds a line that is not a floor check: {"id":"a","actual":-1,"site":"x.ts:1"}',
    );
  });
});
