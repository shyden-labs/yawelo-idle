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

interface Job {
  if?: string;
  needs?: string | string[];
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: unknown;
}

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
  // Every caller of ci.yml grants contents: read alone; a called workflow
  // asking for more would stop the deploys from starting.
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

  // The coverage job already measured every suite; the scan reads its report
  // rather than running the suites a second time.
  it("scans with the coverage job's report, from this run, whenever that job measured", () => {
    expect(read('sonarcloud.yml')).toContain(
      [
        '      - name: Fetch the coverage report this run measured',
        '        if: ${{ inputs.coverage }}',
        '        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2',
        '        with:',
        '          name: coverage',
        '          path: coverage/',
      ].join('\n'),
    );
  });

  // A docs-only change measures nothing, so its scan runs without a report:
  // the scan and its verdict still run, and no step is skipped and passed.
  it('scans and reads the verdict on a docs-only change too', () => {
    const text = read('sonarcloud.yml');
    const conditioned = text.split('\n').filter((l) => /^\s+if:/.test(l));
    expect(conditioned).toEqual(['        if: ${{ inputs.coverage }}']);
  });
});

describe('ci.yml', () => {
  const jobs = (parse(read('ci.yml')) as { jobs: Record<string, Job> }).jobs;

  // Pull requests only: the deploys call ci.yml too, and they hold neither the
  // token nor anything a scan could add once the pull request passed its gate.
  it('runs the SonarCloud scan on pull requests, after coverage, for this repository, with the token', () => {
    expect(jobs['sonarcloud']).toEqual({
      if: "github.event_name == 'pull_request'",
      needs: 'coverage',
      uses: './.github/workflows/sonarcloud.yml',
      with: {
        organization: 'shyden-labs',
        'project-key': 'shyden-labs_yawelo-idle',
        coverage: "${{ needs.coverage.outputs.scope != 'docs-only' }}",
      },
      secrets: 'inherit',
    });
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
