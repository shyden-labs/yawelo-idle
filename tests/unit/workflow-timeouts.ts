import { parse } from 'yaml';
import { isRecord, type Finding } from './workflow-secrets';

/**
 * Every job stops within minutes when a step hangs (#44).
 *
 * A job without `timeout-minutes` runs for GitHub's default of 360 minutes,
 * so a starved download holds a PR (and burns Actions minutes) for hours. The
 * rule: every job that runs steps sets a whole-number timeout from 1 to
 * MAX_TIMEOUT_MINUTES, and no step sets one above its job's (it could never
 * fire).
 *
 * A job that calls a reusable workflow may not set `timeout-minutes` at all
 * (GitHub rejects the key there), so it is covered by the called workflow's
 * own jobs. A local call is reported in `calls` for the caller to check is
 * scanned too; a remote one is a finding, since its jobs are out of reach.
 *
 * The workflow is PARSED, not grepped, so a comment naming `timeout-minutes`
 * can never satisfy this guard.
 */

export const MAX_TIMEOUT_MINUTES = 30;

export interface TimeoutScan {
  /** Jobs that run steps, each checked for a timeout. */
  checked: number;
  /** Local reusable workflows called, as written (`./.github/workflows/x.yml`). */
  calls: string[];
  findings: Finding[];
}

const quoted = (value: unknown) =>
  typeof value === 'string' ? `"${value}"` : String(value);

const isValidMinutes = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_TIMEOUT_MINUTES;

/** Why a value that failed isValidMinutes is wrong. */
function timeoutProblem(value: unknown): string {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return `timeout-minutes ${String(value)} is above ${String(MAX_TIMEOUT_MINUTES)}`;
  }
  return `timeout-minutes ${quoted(value)} is not a whole number from 1 to ${String(MAX_TIMEOUT_MINUTES)}`;
}

export function scanTimeouts(file: string, source: string): TimeoutScan {
  const doc: unknown = parse(source);
  const jobs =
    isRecord(doc) && isRecord(doc.jobs) ? Object.entries(doc.jobs) : [];
  const findings: Finding[] = [];
  const calls: string[] = [];
  let checked = 0;

  for (const [id, job] of jobs) {
    const where = `${file}: jobs.${id}`;
    if (!isRecord(job)) {
      findings.push({ where, problem: 'not a YAML mapping' });
      continue;
    }

    if (typeof job.uses === 'string') {
      if (job.uses.startsWith('./')) {
        calls.push(job.uses);
      } else {
        findings.push({
          where,
          problem: `calls ${job.uses}, whose jobs this repo cannot check for timeouts`,
        });
      }
      continue;
    }

    checked += 1;
    if (!('timeout-minutes' in job)) {
      findings.push({
        where,
        problem: 'no timeout-minutes, so a hung step runs for 360 minutes',
      });
      continue;
    }
    const jobMinutes = job['timeout-minutes'];
    if (!isValidMinutes(jobMinutes)) {
      findings.push({ where, problem: timeoutProblem(jobMinutes) });
      continue;
    }

    const steps = Array.isArray(job.steps) ? job.steps : [];
    for (const [index, step] of steps.entries()) {
      if (!isRecord(step) || !('timeout-minutes' in step)) continue;
      const name =
        typeof step.name === 'string' ? step.name : `#${String(index + 1)}`;
      const stepMinutes = step['timeout-minutes'];
      if (!isValidMinutes(stepMinutes)) {
        findings.push({
          where,
          problem: `step "${name}" has ${timeoutProblem(stepMinutes)}`,
        });
      } else if (stepMinutes > jobMinutes) {
        findings.push({
          where,
          problem: `step "${name}" has timeout-minutes ${String(stepMinutes)}, above its job’s ${String(jobMinutes)}`,
        });
      }
    }
  }

  return { checked, calls, findings };
}
