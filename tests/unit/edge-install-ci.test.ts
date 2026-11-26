import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runOf } from './workflow-steps';

/**
 * The browsers job's Edge install (#1092). Edge comes from
 * packages.microsoft.com, 206 MB, and on 2026-11-23 four of 40 runs stalled
 * there at the step's 3-minute limit while the other 35 took 19–54 s. Shyden:
 * "we should cache these installs so we don't download every single time".
 * apt keeps its downloads in a folder that actions/cache holds between runs,
 * so a run downloads only what a newer Edge brings. A stall that still
 * happens names the download it was on. The workflow is read as parsed YAML,
 * so a comment naming a command cannot stand in for a step.
 */

interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: unknown;
  if?: string;
  shell?: string;
  'timeout-minutes'?: number;
  with?: Record<string, string>;
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
  jobs: Record<string, { steps: Step[] }>;
};
const steps = ci.jobs['browsers']?.steps ?? [];
const at = (name: string): number => steps.findIndex((s) => s.name === name);
const step = (name: string): Step => steps[at(name)] ?? {};

const KEEP = "Keep apt's downloads in the Edge cache folder";
const RESTORE = 'Restore the Edge download';
const INSTALL = "Install Edge (Playwright's image lacks it)";
const VERSION = 'Read the installed Edge version and drop older downloads';
const SAVE = 'Save the Edge download for later runs';
const NOT_DOCS = "steps.classify.outputs.scope != 'docs-only'";
const SHA = '55cc8345863c7cc4c66a329aec7e433d2d1c52a9';
const CACHE_SHA = `${SHA} # v6.1.0`;
// apt's lists ride in the same entry as the downloads (#1136): Playwright's
// image ships none, so Edge's own `apt-get update` would fetch them, and with
// the Ubuntu mirrors down a warm run keeps the lists it restored.
const CACHED = '/root/edge-debs\n/var/lib/apt/lists\n';
// A new prefix: the old `msedge-debs-` entry matched the installed version, so
// it would never be saved again with the lists in it.

describe('the Edge install in the browsers job (#1092)', () => {
  it('runs keep, restore, install, version and save in that order, before the first suite', () => {
    const order = [KEEP, RESTORE, INSTALL, VERSION, SAVE].map(at);
    expect(
      order.every((i) => i >= 0),
      order.join(','),
    ).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const firstSuite = steps.findIndex((s) =>
      runOf(s).startsWith('npm run test:'),
    );
    expect(order[4]).toBeLessThan(firstSuite);
  });

  it('points apt at the cache folder, keeps what it downloads, and removes the image rule that deletes it', () => {
    const run = runOf(step(KEEP));
    expect(run).toContain('rm -f /etc/apt/apt.conf.d/docker-clean');
    expect(run).toContain('mkdir -p /root/edge-debs/partial');
    expect(run).toContain('Dir::Cache::Archives "/root/edge-debs";');
    expect(run).toContain('Binary::apt::APT::Keep-Downloaded-Packages "true";');
    expect(run).toContain('/etc/apt/apt.conf.d/99-edge-cache');
  });

  it('restores the newest saved download, by prefix', () => {
    const s = step(RESTORE);
    expect(s.id).toBe('edge-cache');
    expect(s.uses).toBe(`actions/cache/restore@${SHA}`);
    expect(s.with?.path).toBe(CACHED);
    expect(s.with?.key).toBe('msedge-apt-${{ github.run_id }}');
    expect(s.with?.['restore-keys']).toBe('msedge-apt-');
  });

  it('pins the install command and its limits: 165 s inside, 3 minutes for the step', () => {
    const s = step(INSTALL);
    expect(s['timeout-minutes']).toBe(3);
    expect(s.shell).toBe('bash');
    const run = runOf(s);
    expect(run).toContain('set -o pipefail');
    expect(run).toContain(
      'timeout --kill-after=5 165 npx --no playwright install msedge 2>&1 | tee "$RUNNER_TEMP/edge-install.log"',
    );
  });

  it('names the download and its host when the install stalls', () => {
    const run = runOf(step(INSTALL));
    expect(run).toContain('if [ "$status" = 124 ]; then');
    expect(run).toContain(
      'echo "::error::Edge install stalled at 165 s; its last download was: $(grep -E \'^Get:\' "$RUNNER_TEMP/edge-install.log" | tail -n 1)"',
    );
    expect(run).toContain('exit "$status"');
  });

  it('keys the save on the installed version and drops older Edge downloads first', () => {
    const v = step(VERSION);
    expect(v.id).toBe('edge');
    const run = runOf(v);
    expect(run).toContain(
      "version=$(dpkg-query -W -f='${Version}' microsoft-edge-stable)",
    );
    expect(run).toContain(
      'find /root/edge-debs -name \'microsoft-edge-stable_*.deb\' ! -name "microsoft-edge-stable_${version}_*" -delete',
    );
    expect(run).toContain('echo "version=$version" >> "$GITHUB_OUTPUT"');
  });

  it('saves only when the restored download is not this version', () => {
    const s = step(SAVE);
    expect(s.uses).toBe(`actions/cache/save@${SHA}`);
    expect(s.with?.path).toBe(CACHED);
    expect(s.with?.key).toBe('msedge-apt-${{ steps.edge.outputs.version }}');
    expect(s.if).toBe(
      `\${{ ${NOT_DOCS} && steps.edge-cache.outputs.cache-matched-key != format('msedge-apt-{0}', steps.edge.outputs.version) }}`,
    );
  });

  it.each([KEEP, RESTORE, INSTALL, VERSION])(
    'skips "%s" on a docs-only change',
    (name) => {
      expect(step(name).if).toBe(`\${{ ${NOT_DOCS} }}`);
    },
  );

  it('carries the version comment on both cache pins in the file', () => {
    const text = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(text).toContain(`actions/cache/restore@${CACHE_SHA}`);
    expect(text).toContain(`actions/cache/save@${CACHE_SHA}`);
  });
});
