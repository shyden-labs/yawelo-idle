import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * Node's download kept between runs in the container jobs (#1118; global
 * rule "CI caches every download", copied from shyden-labs/repo-template#224).
 * Playwright's image has no Node tool cache, so setup-node downloaded the
 * exact version every run (~4.5 s, "Attempting to download 26.13.1", run
 * 45721481690). The key names that exact version, read from
 * docker/node/Dockerfile, which Dependabot bumps, so a newer Node misses the
 * cache and downloads. Inside a container the tool cache is /__t (setup-node
 * installed under /__t/node/26.13.1 in that run). Only jobs holding no
 * secret, environment or write permission cache (#1120 judges the rest).
 */

interface Step {
  uses?: string;
  'timeout-minutes'?: number;
  with?: Record<string, unknown>;
}

interface Job {
  container?: unknown;
  environment?: unknown;
  permissions?: Record<string, string>;
  steps?: Step[];
}

const jobOf = (file: string, id: string): Job =>
  (
    parse(readFileSync(`.github/workflows/${file}`, 'utf8')) as {
      jobs: Record<string, Job>;
    }
  ).jobs[id] ?? {};

const CACHE = 'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9';

describe.each([
  ['ci.yml', 'build-and-test'],
  ['ci.yml', 'browsers'],
  ['ci.yml', 'coverage'],
  ['sonarcloud.yml', 'sonar-coverage'],
])('Node in %s job %s (#1118)', (file, id) => {
  const job = jobOf(file, id);
  const steps = job.steps ?? [];
  const setup = steps.findIndex((s) =>
    s.uses?.startsWith('actions/setup-node@'),
  );

  it('is a container job holding no secret, environment or write permission', () => {
    expect({
      container: job.container !== undefined,
      environment: job.environment,
      secrets: /\$\{\{\s*secrets\./.test(JSON.stringify(job)),
      writes: Object.values(job.permissions ?? {}).includes('write'),
    }).toEqual({
      container: true,
      environment: undefined,
      secrets: false,
      writes: false,
    });
  });

  it('restores Node under its exact version just before setting it up, in 5 minutes', () => {
    const cache = steps[setup - 1] ?? {};
    expect({
      uses: cache.uses,
      limit: cache['timeout-minutes'],
      path: cache.with?.['path'],
      key: cache.with?.['key'],
    }).toEqual({
      uses: CACHE,
      limit: 5,
      path: '/__t/node/${{ steps.node.outputs.version }}',
      key: 'node-${{ steps.node.outputs.version }}-${{ runner.os }}-${{ runner.arch }}',
    });
  });

  it('sets Node up from that version in 5 minutes', () => {
    expect({
      limit: steps[setup]?.['timeout-minutes'],
      version: steps[setup]?.with?.['node-version'],
    }).toEqual({ limit: 5, version: '${{ steps.node.outputs.version }}' });
  });
});
