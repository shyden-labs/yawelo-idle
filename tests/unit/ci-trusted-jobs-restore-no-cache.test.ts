import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * A CI job that holds a secret, an environment or a write permission restores
 * nothing from the Actions cache (#1120; global rule "CI caches every
 * download", security exception from shyden-labs/repo-template#224). A cache
 * key is only a name: any job in the same cache scope can write any key, and
 * a dependency's install script can reach the cache token, so a restored
 * file could run beside the job's credential. Such a job downloads fresh:
 * no `actions/cache` step and no `cache:` on any `actions/setup-*` step
 * (shyden-labs/repo-template#227 found the same gap in the template).
 *
 * Every job in every workflow is judged, so a new job is covered the day it
 * is added.
 */

interface Step {
  uses?: string;
  with?: Record<string, unknown>;
}

interface Job {
  environment?: unknown;
  permissions?: unknown;
  steps?: Step[];
}

interface Workflow {
  permissions?: unknown;
  jobs: Record<string, Job>;
}

const DIR = '.github/workflows';

const writes = (permissions: unknown): boolean =>
  permissions === 'write-all' ||
  (typeof permissions === 'object' &&
    permissions !== null &&
    Object.values(permissions).includes('write'));

/** Each job that holds a secret, an environment or a write permission. */
const TRUSTED: [string, string, Job][] = readdirSync(DIR)
  .filter((file) => file.endsWith('.yml'))
  .sort()
  .flatMap((file) => {
    const workflow = parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Workflow;
    return Object.entries(workflow.jobs).flatMap(
      ([id, job]): [string, string, Job][] => {
        const holds =
          /\$\{\{\s*secrets\./.test(JSON.stringify(job)) ||
          job.environment !== undefined ||
          writes(job.permissions ?? workflow.permissions);
        return holds ? [[file, id, job]] : [];
      },
    );
  });

describe('a job holding a secret, an environment or a write permission (#1120)', () => {
  it('exists in this repository, so the judging below reads real jobs', () => {
    expect(TRUSTED.length).toBeGreaterThan(0);
  });

  it.each(TRUSTED)(
    '%s %s restores nothing from the cache',
    (_file, _id, job) => {
      const restores = (job.steps ?? []).flatMap((step) => {
        const uses = step.uses ?? '';
        if (uses.startsWith('actions/cache')) return [uses];
        if (/^actions\/setup-/.test(uses) && step.with?.['cache'] !== undefined)
          return [`${uses} cache: ${JSON.stringify(step.with['cache'])}`];
        return [];
      });
      expect(restores).toEqual([]);
    },
  );
});
