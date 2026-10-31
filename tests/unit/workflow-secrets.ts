import { parse } from 'yaml';

/**
 * Where a workflow may read a secret (spec §12.9).
 *
 * The agent App has `workflows: write`, and this repo is public, so anyone can
 * open a fork PR that runs workflows. That is safe only while every secret is
 * an ENVIRONMENT secret: GitHub hands those to a job only if the job names the
 * environment, and `dev` and `production` each admit one branch. `board-read`
 * (#580) admits pull-request runs (each `refs/pull/<n>/merge`) and holds only the
 * read-only roadmap App's key; a fork's pull request gets no secrets at all,
 * so only branches pushed to this repository can reach it. A secret read
 * outside such a job can only be a repository secret, which any workflow on
 * any branch can read, so the rule this enforces is "no secret reference
 * outside a job that declares one of the protected environments".
 *
 * The workflow is PARSED, not grepped. Comments never reach the parsed tree,
 * so a comment naming `secrets.X` can neither satisfy nor trip this guard
 * (the source-text rule, applied by construction).
 */

export const PROTECTED_ENVIRONMENTS = [
  'dev',
  'production',
  'board-read',
] as const;

/** The token GitHub mints per run. It is not a stored secret. */
const RUN_TOKEN = 'secrets.GITHUB_TOKEN';

export interface Finding {
  where: string;
  problem: string;
}

export interface Scan {
  /** Jobs the scan read, counted as it reads each one, not as listed (#373). */
  jobs: number;
  secretReferences: number;
  /** Every secret reference read, as `file: where: reference` (#367). */
  references: string[];
  findings: Finding[];
}

type Yaml = unknown;

export const isRecord = (value: Yaml): value is Record<string, Yaml> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every string in a parsed YAML value, keys included. */
function strings(value: Yaml): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) => [
      key,
      ...strings(child),
    ]);
  }
  return [];
}

/**
 * Each reference to the secrets context in a string, minus the run token.
 * Matches `secrets.X`, `secrets['X']`, `toJSON(secrets)` and a bare
 * `secrets` key (a reusable-workflow call's `secrets: inherit` or map).
 */
function secretReferences(text: string): string[] {
  return (
    text.match(/\bsecrets\b(?:\.[A-Za-z_][A-Za-z0-9_]*|\s*\[[^\]]*\])?/g) ?? []
  ).filter((ref) => ref !== RUN_TOKEN);
}

function environmentName(environment: Yaml): string | undefined {
  if (typeof environment === 'string') return environment;
  if (isRecord(environment) && typeof environment.name === 'string') {
    return environment.name;
  }
  return undefined;
}

/** The actions a pull_request_target step may use: each runs only what its inputs name. */
const TARGET_ACTIONS = ['actions/checkout@', 'actions/setup-node@'] as const;
/** A tool that can fetch code, standing as a command word in a shell line. */
const FETCHING_TOOL = /(?:^|[\s;&|(`$])(?:git|gh|curl|wget)(?=\s|$)/m;
const ONLY_STATUSES = 'only statuses may be written';

const hasExpression = (value: Yaml): boolean =>
  strings(value).some((text) => text.includes('${{'));

/** Why one step of a pull_request_target job is unsafe, or nothing. */
function targetStepProblems(id: string, step: Yaml): string[] {
  if (!isRecord(step)) return [];
  const problems: string[] = [];
  if (typeof step.run === 'string') {
    if (step.run.includes('${{')) {
      problems.push(
        `jobs.${id} puts an expression in a shell line, where pull-request text could run as a command; pass it through env`,
      );
    }
    if (FETCHING_TOOL.test(step.run)) {
      problems.push(
        `jobs.${id} runs git, gh, curl or wget in a shell line, which could fetch the pull request's code; do that in a reviewed script`,
      );
    }
  }
  if (typeof step.uses !== 'string') return problems;
  const uses = step.uses;
  if (!TARGET_ACTIONS.some((action) => uses.startsWith(action))) {
    problems.push(
      `jobs.${id} uses ${uses}; only actions/checkout and actions/setup-node may run here`,
    );
  }
  if (hasExpression(step.with)) {
    problems.push(
      `jobs.${id} puts an expression in a with: input of ${uses}, where pull-request text could reach code; pass constants only`,
    );
  }
  if (uses.startsWith('actions/checkout@')) {
    const options = isRecord(step.with) ? step.with : {};
    if ('ref' in options || 'repository' in options) {
      problems.push(
        `jobs.${id} checks out a ref or repository, which runs code the pull request chose`,
      );
    }
    if (options['persist-credentials'] !== false) {
      problems.push(
        `jobs.${id} keeps the checkout credential, which later steps could use; set persist-credentials: false`,
      );
    }
  }
  return problems;
}

/**
 * Why a pull_request_target workflow is unsafe, or nothing (#783, #810).
 * GitHub runs the default branch's own copy and checks out the default
 * branch, so it stays safe only while nothing it runs can reach the pull
 * request's code or carry its text: no checkout of a ref or repository, no
 * kept credential, no secret, a token writing nothing but statuses, no
 * expression in a shell line or action input, no fetching tool in a shell
 * line, no action beyond checkout and setup-node, and no reusable workflow.
 */
function targetProblems(
  permissions: Yaml,
  jobs: [string, Yaml][],
  references: string[],
): string[] {
  const problems: string[] = [];
  if (!isRecord(permissions)) {
    problems.push(
      'it sets no permissions map, so its token keeps the repository default; set one writing nothing but statuses',
    );
  }
  const writes = (scopes: Yaml): string[] =>
    isRecord(scopes)
      ? Object.keys(scopes).filter(
          (scope) => scopes[scope] === 'write' && scope !== 'statuses',
        )
      : [];
  problems.push(
    ...writes(permissions).map(
      (scope) => `it can write ${scope}; ${ONLY_STATUSES}`,
    ),
  );
  for (const [id, job] of jobs) {
    if (!isRecord(job)) continue;
    if (typeof job.uses === 'string') {
      problems.push(
        `jobs.${id} calls the reusable workflow ${job.uses}, which these rules cannot follow`,
      );
    }
    if (job.permissions !== undefined && !isRecord(job.permissions)) {
      problems.push(
        `jobs.${id} sets its permissions to ${JSON.stringify(job.permissions)}; set a map writing nothing but statuses`,
      );
    }
    problems.push(
      ...writes(job.permissions).map(
        (scope) => `jobs.${id} can write ${scope}; ${ONLY_STATUSES}`,
      ),
    );
    const steps = Array.isArray(job.steps) ? job.steps : [];
    problems.push(...steps.flatMap((step) => targetStepProblems(id, step)));
  }
  for (const reference of references) {
    problems.push(
      `it reads ${reference.slice(reference.lastIndexOf(' ') + 1)}, which nothing triggered by a pull request may hold`,
    );
  }
  return problems;
}

export function scanWorkflow(file: string, source: string): Scan {
  const doc: Yaml = parse(source);
  if (!isRecord(doc)) {
    return {
      jobs: 0,
      secretReferences: 0,
      references: [],
      findings: [{ where: file, problem: 'not a YAML mapping' }],
    };
  }
  const findings: Finding[] = [];
  const references: string[] = [];

  const triggers = isRecord(doc.on)
    ? Object.keys(doc.on)
    : typeof doc.on === 'string'
      ? [doc.on]
      : Array.isArray(doc.on)
        ? doc.on.filter((t): t is string => typeof t === 'string')
        : [];
  for (const key of Object.keys(doc).filter((k) => k !== 'jobs')) {
    const refs = secretReferences(strings(doc[key]).join('\n'));
    references.push(...refs.map((ref) => `${file}: ${key}: ${ref}`));
    for (const ref of refs) {
      findings.push({
        where: `${file}: ${key}`,
        problem: `${ref} outside any job, so no environment can protect it`,
      });
    }
  }

  const jobs = isRecord(doc.jobs) ? Object.entries(doc.jobs) : [];
  let read = 0;
  for (const [id, job] of jobs) {
    read += 1;
    const refs = secretReferences(strings(job).join('\n'));
    references.push(...refs.map((ref) => `${file}: jobs.${id}: ${ref}`));
    if (refs.length === 0) continue;
    const name = isRecord(job) ? environmentName(job.environment) : undefined;
    const isProtected = (PROTECTED_ENVIRONMENTS as readonly string[]).includes(
      name ?? '',
    );
    if (!isProtected) {
      const declared =
        name === undefined
          ? 'declares no environment'
          : `declares environment "${name}"`;
      for (const ref of refs) {
        findings.push({
          where: `${file}: jobs.${id}`,
          problem: `${ref} in a job that ${declared}; it must be one of ${PROTECTED_ENVIRONMENTS.join(', ')}`,
        });
      }
    }
  }

  if (triggers.includes('pull_request_target')) {
    findings.push(
      ...targetProblems(doc.permissions, jobs, references).map((problem) => ({
        where: `${file}: on`,
        problem: `pull_request_target: ${problem}`,
      })),
    );
  }

  return {
    jobs: read,
    secretReferences: references.length,
    references,
    findings,
  };
}
