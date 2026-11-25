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
 *
 * deploy-dev's two browser jobs install Edge the same way (#1115): run
 * 45668410232's smoke stalled at the 3-minute limit on a slow Ubuntu mirror,
 * while 20 passing installs in the 10 runs before it took 18–55 s, so 3 times
 * the slowest is 165 s (#476), the same inner limit. Only `smoke` saves:
 * `site-smoke` runs beside it and would race it for the same key.
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

interface Place {
  file: string;
  job: string;
  /** The job's docs-only gate, or none where the workflow has no fast path. */
  gate?: string;
  saves: boolean;
}

const NOT_DOCS = "steps.classify.outputs.scope != 'docs-only'";

const PLACES: Place[] = [
  {
    file: '.github/workflows/ci.yml',
    job: 'browsers',
    gate: NOT_DOCS,
    saves: true,
  },
  { file: '.github/workflows/deploy-dev.yml', job: 'smoke', saves: true },
  { file: '.github/workflows/deploy-dev.yml', job: 'site-smoke', saves: false },
];

const stepsOf = ({ file, job }: Place): Step[] =>
  (
    parse(readFileSync(file, 'utf8')) as {
      jobs: Record<string, { steps?: Step[] }>;
    }
  ).jobs[job]?.steps ?? [];

/** `${{ <gate> && <condition> }}`, or `${{ <condition> }}` with no gate. */
const guarded = (place: Place, condition?: string): string | undefined => {
  const parts = [place.gate, condition].filter((p) => p !== undefined);
  return parts.length === 0 ? undefined : `\${{ ${parts.join(' && ')} }}`;
};

const KEEP = "Keep apt's downloads in the Edge cache folder";
const RESTORE = 'Restore the Edge download';
const INSTALL = "Install Edge (Playwright's image lacks it)";
const VERSION = 'Read the installed Edge version and drop older downloads';
const SAVE = 'Save the Edge download for later runs';
const SHA = '55cc8345863c7cc4c66a329aec7e433d2d1c52a9';
const CACHE_SHA = `${SHA} # v6.1.0`;

describe.each(PLACES)(
  'the Edge install in $file job $job (#1092, #1115)',
  (place) => {
    const steps = stepsOf(place);
    const at = (name: string): number =>
      steps.findIndex((s) => s.name === name);
    const step = (name: string): Step => steps[at(name)] ?? {};

    it('runs keep, restore and install (then version and save where it saves) in that order, before the first suite', () => {
      const named = place.saves
        ? [KEEP, RESTORE, INSTALL, VERSION, SAVE]
        : [KEEP, RESTORE, INSTALL];
      const order = named.map(at);
      expect(
        order.every((i) => i >= 0),
        order.join(','),
      ).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      const firstSuite = steps.findIndex((s) =>
        runOf(s).startsWith('npm run test:'),
      );
      expect(firstSuite).toBeGreaterThan(-1);
      expect(order.at(-1)).toBeLessThan(firstSuite);
    });

    it('points apt at the cache folder, keeps what it downloads, and removes the image rule that deletes it', () => {
      const run = runOf(step(KEEP));
      expect(run).toContain('rm -f /etc/apt/apt.conf.d/docker-clean');
      expect(run).toContain('mkdir -p /root/edge-debs/partial');
      expect(run).toContain('Dir::Cache::Archives "/root/edge-debs";');
      expect(run).toContain(
        'Binary::apt::APT::Keep-Downloaded-Packages "true";',
      );
      expect(run).toContain('/etc/apt/apt.conf.d/99-edge-cache');
    });

    it('restores the newest saved download, by prefix', () => {
      const s = step(RESTORE);
      expect(s.id).toBe('edge-cache');
      expect(s.uses).toBe(`actions/cache/restore@${SHA}`);
      expect(s.with?.path).toBe('/root/edge-debs');
      expect(s.with?.key).toBe('msedge-debs-${{ github.run_id }}');
      expect(s.with?.['restore-keys']).toBe('msedge-debs-');
    });

    it('pins the install command and its limits: 165 s inside, 3 minutes for the step', () => {
      const s = step(INSTALL);
      expect(s['timeout-minutes']).toBe(3);
      expect(s.shell).toBe('bash');
      const run = runOf(s);
      expect(run).toContain('set -o pipefail');
      expect(run).toContain(
        'timeout --kill-after=5 165 npx --no playwright install --with-deps msedge 2>&1 | tee "$RUNNER_TEMP/edge-install.log"',
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

    it.each(
      place.saves
        ? [KEEP, RESTORE, INSTALL, VERSION]
        : [KEEP, RESTORE, INSTALL],
    )(
      'gates "%s" as the job does: on a docs-only change where it has one, never otherwise',
      (name) => {
        expect(step(name).if).toBe(guarded(place));
      },
    );

    it('carries the version comment on its cache pins in the file', () => {
      const text = readFileSync(place.file, 'utf8');
      expect(text).toContain(`actions/cache/restore@${CACHE_SHA}`);
    });
  },
);

describe.each(PLACES.filter((p) => p.saves))(
  'the Edge save in $file job $job (#1092, #1115)',
  (place) => {
    const steps = stepsOf(place);
    const at = (name: string): number =>
      steps.findIndex((s) => s.name === name);
    const step = (name: string): Step => steps[at(name)] ?? {};

    it('carries the version comment on its save pin', () => {
      expect(readFileSync(place.file, 'utf8')).toContain(
        `actions/cache/save@${CACHE_SHA}`,
      );
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
      expect(s.with?.path).toBe('/root/edge-debs');
      expect(s.with?.key).toBe('msedge-debs-${{ steps.edge.outputs.version }}');
      expect(s.if).toBe(
        guarded(
          place,
          "steps.edge-cache.outputs.cache-matched-key != format('msedge-debs-{0}', steps.edge.outputs.version)",
        ),
      );
    });
  },
);

describe.each(PLACES.filter((p) => !p.saves))(
  'the Edge restore-only job $job in $file (#1115)',
  (place) => {
    const steps = stepsOf(place);
    const at = (name: string): number =>
      steps.findIndex((s) => s.name === name);

    it('saves nothing, so it never races the job that does', () => {
      expect(at(VERSION)).toBe(-1);
      expect(at(SAVE)).toBe(-1);
      expect(
        steps.filter((s) => s.uses?.startsWith('actions/cache/save@')),
      ).toEqual([]);
    });
  },
);
