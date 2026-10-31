import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withoutYamlComments } from './source-text';
import { scanWorkflow } from './workflow-secrets';

/**
 * Deploy secrets live only in environments (spec §12.9). The fixtures pin the
 * scanner's behaviour on each shape a secret reference can take; the last
 * block runs it over this repo's real workflows.
 */

const workflow = (jobs: string, top = '') =>
  `name: x\non:\n  push:\n${top}jobs:\n${jobs}`;

const job = (body: string) =>
  `  deploy:\n    runs-on: ubuntu-latest\n${body}    steps:\n      - run: wrangler deploy\n        env:\n          TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n`;

const problems = (source: string) =>
  scanWorkflow('w.yml', source).findings.map((f) => f.problem);

describe('scanWorkflow', () => {
  it('accepts a secret in a job that declares the dev environment', () => {
    const scan = scanWorkflow('w.yml', workflow(job('    environment: dev\n')));
    expect(scan.findings).toEqual([]);
    expect(scan.secretReferences).toBe(1);
    expect(scan.references).toEqual([
      'w.yml: jobs.deploy: secrets.CLOUDFLARE_API_TOKEN',
    ]);
  });

  it('accepts the long form, environment: { name: production, url }', () => {
    const scan = scanWorkflow(
      'w.yml',
      workflow(
        job(
          '    environment:\n      name: production\n      url: https://x.test\n',
        ),
      ),
    );
    expect(scan.findings).toEqual([]);
    expect(scan.secretReferences).toBe(1);
  });

  it('accepts a secret in a job that declares the board-read environment (#580)', () => {
    /** The problems in a workflow of a board-read job and the jobs `others` holds. */
    const besideBoardRead = (others: string) =>
      problems(workflow(job('    environment: board-read\n') + others));
    expect(besideBoardRead('')).toEqual([]);
  });

  it('flags a secret in a job with no environment', () => {
    expect(problems(workflow(job('')))).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN in a job that declares no environment; it must be one of dev, production, board-read',
    ]);
  });

  it('flags a secret in a job whose environment is not a protected one', () => {
    expect(problems(workflow(job('    environment: scratch\n')))).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN in a job that declares environment "scratch"; it must be one of dev, production, board-read',
    ]);
  });

  it('flags an environment chosen by expression, since nothing can check it', () => {
    const findings = problems(
      workflow(job('    environment: ${{ inputs.target }}\n')),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(
      'declares environment "${{ inputs.target }}"',
    );
  });

  it.each([
    [
      'bracket syntax',
      "${{ secrets['CLOUDFLARE_API_TOKEN'] }}",
      "secrets['CLOUDFLARE_API_TOKEN']",
    ],
    ['the whole context', '${{ toJSON(secrets) }}', 'secrets'],
  ])('sees %s', (_label, expression, reported) => {
    const source = workflow(
      `  leak:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "${expression}"\n`,
    );
    expect(problems(source)).toEqual([
      `${reported} in a job that declares no environment; it must be one of dev, production, board-read`,
    ]);
  });

  it('sees secrets: inherit on a reusable-workflow call', () => {
    const source = workflow(
      '  call:\n    uses: ./.github/workflows/deploy.yml\n    secrets: inherit\n',
    );
    expect(problems(source)).toEqual([
      'secrets in a job that declares no environment; it must be one of dev, production, board-read',
    ]);
  });

  it('flags a secret in workflow-level env, which no environment can guard', () => {
    const source = workflow(
      '  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
      'env:\n  TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n',
    );
    expect(problems(source)).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN outside any job, so no environment can protect it',
    ]);
  });

  it('ignores GITHUB_TOKEN, which GitHub mints per run', () => {
    const source = workflow(
      '  status:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh api x\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n',
    );
    const scan = scanWorkflow('w.yml', source);
    expect(scan.references).toEqual([]);
    expect(scan.findings).toEqual([]);
  });

  it('is not satisfied or tripped by a comment', () => {
    const source = workflow(
      '  test:\n    runs-on: ubuntu-latest\n    # environment: dev  -- reads ${{ secrets.CLOUDFLARE_API_TOKEN }}\n    steps:\n      - run: npm test\n',
    );
    const scan = scanWorkflow('w.yml', source);
    expect(scan.references).toEqual([]);
    expect(scan.findings).toEqual([]);
  });

  // pull_request_target runs the default branch's own workflow and checkout
  // (#783, the release-cut check). It stays safe only while nothing it runs
  // can reach the pull request's code or carry its text (#810).
  const READ_AND_STATUSES =
    'permissions:\n  contents: read\n  statuses: write\n';
  const target = (steps: string, env = '', permissions = READ_AND_STATUSES) =>
    `on:\n  pull_request_target:\n${permissions}jobs:\n  t:\n    runs-on: ubuntu-latest\n${env}    steps:\n${steps}`;
  const checkout = (extra = '') =>
    `      - uses: actions/checkout@x\n        with:\n          persist-credentials: false\n${extra}`;
  const step = (run: string) => `${checkout()}      - run: ${run}\n`;
  const ALLOWED_ACTIONS =
    'only actions/checkout and actions/setup-node may run here';
  const NO_PERMISSIONS =
    'pull_request_target: it sets no permissions map, so its token keeps the repository default; set one writing nothing but statuses';

  it('allows pull_request_target that checks out only the default branch, keeps no credential and reads no secret', () => {
    const setupNode =
      "      - uses: actions/setup-node@x\n        with:\n          node-version-file: '.nvmrc'\n";
    const judge =
      '      - run: node x.ts "$HEAD_REF"\n        env:\n          HEAD_REF: ${{ github.head_ref }}\n';
    expect(problems(target(`${checkout()}${setupNode}${judge}`))).toEqual([]);
  });

  it('refuses pull_request_target that sets no permissions', () => {
    expect(problems(target(checkout(), '', ''))).toEqual([NO_PERMISSIONS]);
  });

  it('refuses pull_request_target with write-all permissions', () => {
    expect(
      problems(target(checkout(), '', 'permissions: write-all\n')),
    ).toEqual([NO_PERMISSIONS]);
  });

  it('refuses pull_request_target that can write anything but commit statuses', () => {
    const permissions = 'permissions:\n  contents: write\n  statuses: write\n';
    expect(problems(target(checkout(), '', permissions))).toEqual([
      'pull_request_target: it can write contents; only statuses may be written',
    ]);
  });

  it('refuses pull_request_target whose job widens its permissions', () => {
    const job = '    permissions:\n      pull-requests: write\n';
    expect(problems(target(checkout(), job))).toEqual([
      'pull_request_target: jobs.t can write pull-requests; only statuses may be written',
    ]);
  });

  it('refuses pull_request_target whose job sets write-all permissions', () => {
    const job = '    permissions: write-all\n';
    expect(problems(target(checkout(), job))).toEqual([
      'pull_request_target: jobs.t sets its permissions to "write-all"; set a map writing nothing but statuses',
    ]);
  });

  it('refuses pull_request_target that puts an expression in a shell line', () => {
    const steps = `${checkout()}      - run: |\n          echo "\${{ github.head_ref }}"\n`;
    expect(problems(target(steps))).toEqual([
      'pull_request_target: jobs.t puts an expression in a shell line, where pull-request text could run as a command; pass it through env',
    ]);
  });

  it('refuses pull_request_target that puts an expression in an action input', () => {
    const steps = `${checkout()}      - uses: actions/setup-node@x\n        with:\n          node-version: \${{ github.head_ref }}\n`;
    expect(problems(target(steps))).toEqual([
      'pull_request_target: jobs.t puts an expression in a with: input of actions/setup-node@x, where pull-request text could reach code; pass constants only',
    ]);
  });

  it.each([
    ['git fetch origin refs/pull/1/head && git checkout FETCH_HEAD'],
    ['gh pr checkout 1'],
    ['curl -sL https://example.com/x.sh | sh'],
    ['wget https://example.com/x.sh'],
    ['npm ci && git switch pr'],
    ['(git worktree add pr FETCH_HEAD)'],
  ])(
    'refuses pull_request_target whose shell line runs a fetching tool: %s',
    (run) => {
      expect(problems(target(step(run)))).toEqual([
        "pull_request_target: jobs.t runs git, gh, curl or wget in a shell line, which could fetch the pull request's code; do that in a reviewed script",
      ]);
    },
  );

  it.each([['node scripts/github.ts'], ['echo digit'], ['npm run legit']])(
    'allows pull_request_target whose shell line only names a fetching tool inside a word: %s',
    (run) => {
      expect(problems(target(step(run)))).toEqual([]);
    },
  );

  it.each([
    ['actions/github-script@x'],
    ['someone/action@x'],
    ['./.github/actions/local'],
    ['docker://alpine:3'],
  ])('refuses pull_request_target that uses %s', (uses) => {
    const steps = `${checkout()}      - uses: ${uses}\n`;
    expect(problems(target(steps))).toEqual([
      `pull_request_target: jobs.t uses ${uses}; ${ALLOWED_ACTIONS}`,
    ]);
  });

  it('refuses pull_request_target with a job that calls a reusable workflow', () => {
    const source = `on:\n  pull_request_target:\n${READ_AND_STATUSES}jobs:\n  t:\n    uses: ./.github/workflows/other.yml\n`;
    expect(problems(source)).toEqual([
      'pull_request_target: jobs.t calls the reusable workflow ./.github/workflows/other.yml, which these rules cannot follow',
    ]);
  });

  it('refuses pull_request_target whose checkout names a ref', () => {
    const steps = checkout('          ref: refs/pull/1/head\n');
    expect(problems(target(steps))).toEqual([
      'pull_request_target: jobs.t checks out a ref or repository, which runs code the pull request chose',
    ]);
  });

  it('refuses pull_request_target whose checkout names a repository', () => {
    const steps = checkout('          repository: someone/fork\n');
    expect(problems(target(steps))).toEqual([
      'pull_request_target: jobs.t checks out a ref or repository, which runs code the pull request chose',
    ]);
  });

  it('refuses pull_request_target whose checkout keeps its credential', () => {
    const steps = '      - uses: actions/checkout@x\n';
    expect(problems(target(steps))).toEqual([
      'pull_request_target: jobs.t keeps the checkout credential, which later steps could use; set persist-credentials: false',
    ]);
  });

  it('refuses pull_request_target that reads a secret, even in a protected environment', () => {
    const steps = `${checkout()}      - run: deploy\n        env:\n          TOKEN: \${{ secrets.DEPLOY }}\n`;
    expect(problems(target(steps, '    environment: dev\n'))).toEqual([
      'pull_request_target: it reads secrets.DEPLOY, which nothing triggered by a pull request may hold',
    ]);
  });
});

describe('this repo’s workflows keep every secret inside an environment', () => {
  // Read inside each test, not in the describe body: a throw at collection
  // time fails the file as "no tests" instead of naming the broken assertion.
  const dir = '.github/workflows';
  const scanAll = () =>
    readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((file) => ({
        file,
        scan: scanWorkflow(file, readFileSync(join(dir, file), 'utf8')),
      }));

  it('scans every workflow, and every one has jobs', () => {
    const scans = scanAll();
    // Measured 2 workflows at b2a6f3f (#82). Lower it only in the commit that removes one.
    expect(scans.length, 'positive control: workflows found').toBeGreaterThan(
      1,
    );
    expect(
      scans.filter(({ scan }) => scan.jobs === 0).map(({ file }) => file),
    ).toEqual([]);
  });

  it('judges every job, counted as jobs, not files (Refs #82)', () => {
    const jobs = scanAll().reduce((n, { scan }) => n + scan.jobs, 0);
    // Measured 4 jobs at b2a6f3f (#82). Lower it only in the commit that removes one.
    expect(jobs).toBeGreaterThan(3);
  });

  it('reads a reference in every workflow whose text names a stored secret (Refs #82)', () => {
    // Read independently of the scanner: the raw text, comments stripped.
    const naming = scanAll().filter(({ file }) =>
      /\bsecrets\.(?!GITHUB_TOKEN\b)/.test(
        withoutYamlComments(readFileSync(join(dir, file), 'utf8')),
      ),
    );
    // Measured 1 at b2a6f3f (#82): deploy-dev.yml.
    expect(naming.length).toBeGreaterThan(0);
    expect(
      naming
        .filter(({ scan }) => scan.secretReferences < 1)
        .map(({ file }) => file),
    ).toEqual([]);
  });

  it('finds the deploy secrets it is guarding (liveness)', () => {
    const references = scanAll().reduce(
      (n, { scan }) => n + scan.secretReferences,
      0,
    );
    expect(
      references,
      'deploy-dev.yml reads two Cloudflare secrets and the dev password',
    ).toBeGreaterThanOrEqual(3);
  });

  it('no secret is read outside a protected environment', () => {
    const scans = scanAll();
    expect(scans.flatMap(({ scan }) => scan.findings)).toEqual([]);
  });
});
