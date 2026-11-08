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
      'deploy-dev.yml',
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
  // condition can skip the check (#782).
  it('runs on pull requests, as one job with exactly its keys, in the sonarcloud environment', () => {
    const doc = parse(read('sonarcloud.yml')) as {
      on: unknown;
      jobs: Record<string, Record<string, unknown>>;
    };
    expect({
      on: doc.on,
      jobs: Object.keys(doc.jobs),
      keys: Object.keys(doc.jobs['sonarcloud'] ?? {}),
      environment: doc.jobs['sonarcloud']?.['environment'],
    }).toEqual({
      on: { pull_request: null },
      jobs: ['sonarcloud'],
      keys: ['runs-on', 'timeout-minutes', 'container', 'environment', 'steps'],
      environment: 'sonarcloud',
    });
  });

  it('measures coverage before it scans', () => {
    const text = read('sonarcloud.yml');
    const measure = text.indexOf('run: npm run test:coverage');
    expect({
      measures: measure > -1,
      beforeScan: measure < text.indexOf('SonarSource/sonarqube-scan-action@'),
    }).toEqual({
      measures: true,
      beforeScan: true,
    });
  });

  // A docs-only change measures nothing (#360), so its scan runs without a
  // report: the scan and its verdict still run, and no step is skipped and passed.
  it('skips only the install and the measure on a docs-only change', () => {
    const conditioned = read('sonarcloud.yml')
      .split('\n')
      .filter((l) => /^\s+if:/.test(l));
    expect(conditioned).toEqual([
      "        if: ${{ steps.classify.outputs.scope != 'docs-only' }}",
      "        if: ${{ steps.classify.outputs.scope != 'docs-only' }}",
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
