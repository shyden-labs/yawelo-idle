import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  scanWithoutVerdict,
  swallowed,
  tokenGated,
} from './workflow-honesty.ts';

/**
 * A check is green only if it ran and passed (Shyden 2026-10-18: "don't pass
 * if it doesn't run"; shyden-labs/repo-template#27, adopted here by #655). No
 * workflow swallows a failure, no step runs only when the SonarCloud token is
 * missing, and a scan is always followed by the step that reads its verdict.
 * Each form is planted below and watched red.
 */

const WORKFLOWS = '.github/workflows';
const files = readdirSync(WORKFLOWS)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort();
const read = (f: string) => readFileSync(`${WORKFLOWS}/${f}`, 'utf8');

describe('every workflow', () => {
  it('is judged', () => {
    expect(files).toEqual([
      'board-orphans.yml',
      'check-release-cut.yml',
      'ci.yml',
      'dependabot-daily.yml',
      'deploy-dev.yml',
      'deploy-door.yml',
      'deploy-prod.yml',
      'dev-behind-develop.yml',
      'logs.yml',
      'npm-audit-daily.yml',
      'rollback-prod.yml',
      'sonarcloud.yml',
    ]);
  });

  it.each(files)(
    '%s swallows no failure and gates no step on the token',
    (file) => {
      expect([
        ...swallowed(file, read(file)),
        ...tokenGated(file, read(file)),
      ]).toEqual([]);
    },
  );
});

describe('sonarcloud.yml', () => {
  // Reading the repository is all it needs: the scan and its verdict use the token.
  it('asks for nothing beyond reading the repository', () => {
    expect(
      (parse(read('sonarcloud.yml')) as { permissions: unknown }).permissions,
    ).toEqual({ contents: 'read' });
  });

  it('fails first when the token is missing, naming the key and where it is set', () => {
    expect(read('sonarcloud.yml')).toContain(
      [
        '    steps:',
        '      - name: The SonarCloud token is set',
        '        env:',
        '          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}',
        '        run: |',
        '          if [ -z "$SONAR_TOKEN" ]; then',
        '            echo "::error title=SONAR_TOKEN is missing::Set SONAR_TOKEN as an Actions secret, and as a Dependabot secret for Dependabot pull requests (#655)."',
        '            exit 1',
        '          fi',
      ].join('\n'),
    );
  });

  it('scans, then reads the verdict of that scan', () => {
    const text = read('sonarcloud.yml');
    expect({
      scans: text.includes('SonarSource/sonarqube-scan-action@'),
      problems: scanWithoutVerdict('sonarcloud.yml', text),
    }).toEqual({ scans: true, problems: [] });
  });

  // Shyden, 2026-11-08: its own pull-request workflow, measuring coverage
  // itself, so the deploys that call ci.yml are untouched and no job-level
  // condition can skip the check (#782). Two jobs: the one that runs the
  // project's code (dependencies, tests) holds no secret, and the one that
  // holds the token runs none of it, so a hostile dependency cannot read it.
  // Both are required checks, so a failed measure is red, never skipped.
  const doc = () =>
    parse(read('sonarcloud.yml')) as {
      on: unknown;
      jobs: Record<
        string,
        Record<string, unknown> & { steps: Record<string, unknown>[] }
      >;
    };

  it('runs on pull requests as two jobs, each with exactly its keys', () => {
    const { on, jobs } = doc();
    expect({
      on,
      jobs: Object.fromEntries(
        Object.entries(jobs).map(([id, job]) => [id, Object.keys(job)]),
      ),
    }).toEqual({
      on: { pull_request: null },
      jobs: {
        'sonar-coverage': [
          'runs-on',
          'timeout-minutes',
          'container',
          'outputs',
          'steps',
        ],
        sonarcloud: [
          'needs',
          'runs-on',
          'timeout-minutes',
          'environment',
          'steps',
        ],
      },
    });
  });

  it('measures in a job that reads no secret, and scans in the sonarcloud environment after it', () => {
    const { jobs } = doc();
    expect({
      measureReadsSecrets: JSON.stringify(jobs['sonar-coverage']).includes(
        'secrets.',
      ),
      scanNeeds: jobs['sonarcloud']?.['needs'],
      scanEnvironment: jobs['sonarcloud']?.['environment'],
    }).toEqual({
      measureReadsSecrets: false,
      scanNeeds: 'sonar-coverage',
      scanEnvironment: 'sonarcloud',
    });
  });

  it('runs none of the dependencies or tests where the token is', () => {
    const runs = (doc().jobs['sonarcloud']?.steps ?? []).flatMap((step) =>
      typeof step['run'] === 'string' ? [step['run']] : [],
    );
    expect(runs.filter((run) => /\bnpm\b|\bnpx\b|vitest/.test(run))).toEqual(
      [],
    );
  });

  it('measures coverage and hands the report over as an artifact', () => {
    const text = read('sonarcloud.yml');
    expect({
      measures: text.includes('run: npm run test:coverage'),
      uploads: text.includes('uses: actions/upload-artifact@'),
      downloads: text.includes('uses: actions/download-artifact@'),
    }).toEqual({ measures: true, uploads: true, downloads: true });
  });

  // A docs-only change measures nothing (#360), so its scan runs without a
  // report: the scan and its verdict still run, and no step is skipped and passed.
  it('skips only the install, the measure and the hand-over on a docs-only change', () => {
    const conditioned = read('sonarcloud.yml')
      .split('\n')
      .filter((l) => /^\s+if:/.test(l))
      .map((l) => l.trim());
    expect(conditioned).toEqual([
      "if: ${{ steps.classify.outputs.scope != 'docs-only' }}",
      "if: ${{ steps.classify.outputs.scope != 'docs-only' }}",
      "if: ${{ steps.classify.outputs.scope != 'docs-only' }}",
      "if: ${{ needs.sonar-coverage.outputs.scope != 'docs-only' }}",
    ]);
  });
});

describe('the checks', () => {
  it.each([
    ['|| true on a test command', '      - run: npm run test:coverage || true'],
    ['|| exit 0 on a scan', '        run: sonar-scanner || exit 0'],
    ['|| : on a step', '        run: npm test || :'],
    ['continue-on-error', '        continue-on-error: true'],
  ])('names %s', (_kind, line) => {
    expect(swallowed('w.yml', `steps:\n${line}\n`)).toEqual([
      `w.yml:2 swallows a failure: ${line.trim()}`,
    ]);
  });

  it('reads a comment naming || true as nothing', () => {
    expect(
      swallowed('w.yml', 'steps:\n  # never write || true here\n'),
    ).toEqual([]);
  });

  it('names the line a failure is swallowed on, counting blank and comment lines', () => {
    expect(
      swallowed('w.yml', 'steps:\n\n  # note\n      - run: a || true\n'),
    ).toEqual(['w.yml:4 swallows a failure: - run: a || true']);
  });

  it('names a step that runs only on an empty token', () => {
    expect(
      tokenGated(
        'w.yml',
        "steps:\n      - if: env.SONAR_TOKEN == ''\n        run: echo skipped\n",
      ),
    ).toEqual([
      "w.yml:2 gates a step on the token: - if: env.SONAR_TOKEN == ''",
    ]);
  });

  it('names a scan with no verdict step after it', () => {
    expect(
      scanWithoutVerdict(
        'w.yml',
        'steps:\n      - uses: SonarSource/sonarqube-scan-action@abc\n',
      ),
    ).toEqual([
      'w.yml scans, but no step after it runs scripts/sonar-verdict.ts',
    ]);
  });

  it('names a verdict step that comes before the scan', () => {
    expect(
      scanWithoutVerdict(
        'w.yml',
        'steps:\n      - run: node scripts/sonar-verdict.ts x\n      - uses: SonarSource/sonarqube-scan-action@abc\n',
      ),
    ).toEqual([
      'w.yml scans, but no step after it runs scripts/sonar-verdict.ts',
    ]);
  });

  it('passes a workflow that does not scan', () => {
    expect(
      scanWithoutVerdict('w.yml', 'steps:\n      - run: npm ci\n'),
    ).toEqual([]);
  });
});
