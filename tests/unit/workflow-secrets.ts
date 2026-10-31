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

const PULL_REQUEST_TARGET =
  'pull_request_target runs fork code with this repo’s secrets and a write token';

/**
 * Why a pull_request_target workflow is unsafe, or nothing. GitHub runs the
 * default branch's own copy and checks out the default branch (#783, the
 * release-cut check), so it stays safe only while no checkout fetches the
 * pull request or another repository, no checkout keeps its credential, no
 * step reads a secret, the token writes nothing but commit statuses, and no
 * shell line holds an expression (which could carry text the pull request's
 * author chose, such as its branch name).
 */
function targetProblems(
  permissions: Yaml,
  jobs: [string, Yaml][],
  references: string[],
): string[] {
  const problems: string[] = [];
  if (!isRecord(permissions)) {
    problems.push(
      'it sets no permissions; set them, writing nothing but statuses',
    );
  }
  const writes = (scopes: Yaml): string[] =>
    isRecord(scopes)
      ? Object.keys(scopes).filter(
          (scope) => scopes[scope] === 'write' && scope !== 'statuses',
        )
      : [];
  problems.push(...writes(permissions).map((scope) => `it can write ${scope}`));
  for (const [id, job] of jobs) {
    if (!isRecord(job)) continue;
    if (job.permissions !== undefined && !isRecord(job.permissions)) {
      problems.push(
        `jobs.${id} sets its permissions to ${JSON.stringify(job.permissions)}`,
      );
    }
    problems.push(
      ...writes(job.permissions).map(
        (scope) => `jobs.${id} can write ${scope}`,
      ),
    );
    const steps = Array.isArray(job.steps) ? job.steps : [];
    if (
      steps.some(
        (step) =>
          isRecord(step) &&
          typeof step.run === 'string' &&
          step.run.includes('${{'),
      )
    ) {
      problems.push(`jobs.${id} puts an expression in a shell line`);
    }
    for (const step of steps) {
      if (!isRecord(step) || typeof step.uses !== 'string') continue;
      if (!step.uses.startsWith('actions/checkout@')) continue;
      const options = isRecord(step.with) ? step.with : {};
      if ('ref' in options || 'repository' in options) {
        problems.push(`jobs.${id} checks out a ref or repository`);
      }
      if (options['persist-credentials'] !== false) {
        problems.push(`jobs.${id} keeps the checkout credential`);
      }
    }
  }
  for (const reference of references) {
    problems.push(
      `it reads ${reference.slice(reference.lastIndexOf(' ') + 1)}`,
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
        problem: `${PULL_REQUEST_TARGET}: ${problem}`,
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
