import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { runOf } from './workflow-steps';

/**
 * Reading a workflow file as parsed YAML for the workflow tests, in one home
 * (#84, from the copies record-floors-workflow and board-orphans-workflow
 * held): a comment naming a command can never stand in for a step. Each
 * helper refuses, naming the file, a shape it cannot read rather than
 * answering for it.
 */

export const WORKFLOWS_DIR = '.github/workflows';

export interface WorkflowStep {
  readonly name?: string;
  readonly id?: string;
  readonly if?: string;
  readonly uses?: string;
  // YAML may type it otherwise: read it through runOf.
  readonly run?: unknown;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly with?: Readonly<Record<string, unknown>>;
}

export interface WorkflowJob {
  readonly if?: string;
  readonly 'runs-on'?: string;
  readonly 'timeout-minutes'?: number;
  readonly environment?: unknown;
  readonly container?: { readonly image?: string };
  readonly env?: Readonly<Record<string, unknown>>;
  readonly permissions?: unknown;
  readonly strategy?: {
    readonly 'fail-fast'?: boolean;
    readonly matrix?: Readonly<Record<string, unknown>>;
  };
  readonly steps?: readonly WorkflowStep[];
}

export interface Workflow {
  readonly on?: unknown;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly permissions?: unknown;
  readonly concurrency?: unknown;
  readonly jobs?: Readonly<Record<string, WorkflowJob>>;
}

/** `.github/workflows/<file>` parsed; throws, naming it, for one that holds no jobs. */
export function workflow(file: string): Workflow {
  const parsed = parse(
    readFileSync(join(WORKFLOWS_DIR, file), 'utf8'),
  ) as Workflow;
  if (parsed.jobs === undefined || Object.keys(parsed.jobs).length === 0)
    throw new Error(`${file} holds no jobs`);
  return parsed;
}

/** The workflow's one job, which must be `id`; any other shape is refused. */
export function onlyJob(file: string, id: string): WorkflowJob {
  const jobs = workflow(file).jobs ?? {};
  if (Object.keys(jobs).join() !== id)
    throw new Error(
      `${file} holds jobs ${Object.keys(jobs).join(', ')}, not ${id} alone`,
    );
  return jobs[id] as WorkflowJob;
}

/** The step of `file`'s one job `id` named `name`, which must be there once. */
export function stepNamed(
  file: string,
  id: string,
  name: string,
): WorkflowStep {
  const found = (onlyJob(file, id).steps ?? []).filter((s) => s.name === name);
  if (found.length !== 1)
    throw new Error(
      `${file} holds ${String(found.length)} steps named "${name}"`,
    );
  return found[0] as WorkflowStep;
}

/** Every workflow file, by name. */
export const workflowFiles = (): string[] =>
  readdirSync(WORKFLOWS_DIR).filter((f) => /\.ya?ml$/.test(f));

/**
 * Every place `file` sets or names the environment variable `name`, as
 * `file: where`: the workflow's env, a job's, a step's, or a step's run.
 */
export function envSites(file: string, name: string): string[] {
  const parsed = workflow(file);
  const sites: string[] = [];
  if (parsed.env !== undefined && name in parsed.env)
    sites.push(`${file}: env`);
  for (const [id, j] of Object.entries(parsed.jobs ?? {})) {
    if (j.env !== undefined && name in j.env) sites.push(`${file}: ${id}.env`);
    for (const [i, s] of (j.steps ?? []).entries()) {
      const where = `${id}.steps[${String(i)}]`;
      if (s.env !== undefined && name in s.env)
        sites.push(`${file}: ${where}.env`);
      if (runOf(s).includes(name)) sites.push(`${file}: ${where}.run`);
    }
  }
  return sites;
}
