import { describe, expect, it } from 'vitest';
import {
  mutableSuites,
  readObservations,
  runEnv,
  vitestArgs,
  type MutableSuite,
  type RunRequest,
} from '../../scripts/mutate';
import { RECORD_ENV, SUITES, type Suite } from '../../scripts/record-floors';
import { REPORT_ENV } from '../../scripts/mutate-reporter';

/**
 * The suites the mutation runner can run (#527, spec §5), and how it runs
 * them: the six vitest suites run from the root, each under its own config,
 * with both reporters, recording floors only when asked. The harness and
 * Playwright suites wait on #649.
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
        { ...SUITE, mutate: { config: 'vitest.guards.config.ts' } },
      ]),
    ).toEqual([{ name: 'guards suite', config: 'vitest.guards.config.ts' }]);
  });

  it('keeps a suite run under vitest’s default config', () => {
    expect(
      mutableSuites([{ ...SUITE, name: 'unit suite', mutate: {} }]),
    ).toEqual([{ name: 'unit suite', config: undefined }]);
  });

  it('leaves out a suite with no mutate command', () => {
    expect(
      mutableSuites([SUITE, { ...SUITE, name: 'unit suite', mutate: {} }]),
    ).toEqual([{ name: 'unit suite', config: undefined }]);
  });

  it('refuses a mutable suite that does not run from the root', () => {
    expect(() =>
      mutableSuites([{ ...SUITE, cwd: 'apps/web', mutate: {} }]),
    ).toThrow(
      'guards suite runs from apps/web: the runner runs suites from the root only (#649)',
    );
  });

  it('can run exactly the six root vitest suites, under their own configs', () => {
    expect(mutableSuites(SUITES)).toEqual([
      { name: 'unit suite', config: undefined },
      { name: 'guards suite', config: 'vitest.guards.config.ts' },
      { name: 'integration suite', config: 'vitest.integration.config.ts' },
      { name: 'properties suite', config: 'vitest.properties.config.ts' },
      { name: 'logs suite', config: 'vitest.logs.config.ts' },
      { name: 'pacing suite', config: 'vitest.pacing.config.ts' },
    ]);
  });
});

const GUARDS: MutableSuite = {
  name: 'guards suite',
  config: 'vitest.guards.config.ts',
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
        { ...RUN, suite: { name: 'unit suite', config: undefined } },
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
      [RECORD_ENV]: '/repo/.mutations/x/o.jsonl',
    });
  });

  it('drops a recording the caller inherited, so a judged run fails on floors', () => {
    expect(
      runEnv({ PATH: '/bin', [RECORD_ENV]: '/tmp/x' }, RUN, '/repo'),
    ).toEqual({ PATH: '/bin', [REPORT_ENV]: '/repo/.mutations/x/blind.json' });
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
