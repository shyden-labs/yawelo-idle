import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { parse } from 'yaml';
import { withoutYamlComments, withoutYamlQuotes } from './source-text';

import { isRecord } from './workflow-secrets';

/**
 * The CI supply chain is pinned, and something keeps it current.
 *
 * Two failure modes, and they pull in opposite directions:
 *
 * 1. A MUTABLE TAG is not a version. `actions/checkout@v4` resolves to
 *    whatever the tag points at today, and a tag can be repointed by anyone
 *    who can push to that repo. A compromised or coerced maintainer moves the
 *    tag and every workflow in this repo runs their code, with our secrets,
 *    on the next push. Pinning to a full commit SHA is the only form of this
 *    reference that cannot be changed underneath us.
 *
 * 2. A PIN THAT NOBODY BUMPS rots. shyden.co.uk sat three majors behind on
 *    both of its actions with no mechanism to notice. So the SHA is only half
 *    the control — Dependabot is the other half, and the version comment
 *    beside each SHA is what makes a bump reviewable by a human instead of an
 *    opaque hex swap.
 *
 * The `uses:` and Dependabot checks read SOURCE TEXT, stripped of comments
 * where it matters. The container-image checks PARSE the workflows (`yaml`),
 * since `container:` is either a string or a mapping and a comment must not
 * count as an image.
 */

const WORKFLOWS = '.github/workflows';
const DEPENDABOT = '.github/dependabot.yml';

const workflowFiles = () =>
  readdirSync(WORKFLOWS).filter(
    (f) => f.endsWith('.yml') || f.endsWith('.yaml'),
  );

/**
 * Every `uses:` naming a THIRD-PARTY action.
 *
 * Local references (`./.github/actions/x`, `./.github/workflows/y.yml`) are
 * excluded deliberately: they are this repo's own code, already reviewed at
 * the commit that introduced them, and have no upstream SHA to pin.
 */
const externalUses = () =>
  workflowFiles().flatMap((file) =>
    readFileSync(join(WORKFLOWS, file), 'utf8')
      .split('\n')
      .map((text, i) => ({
        where: `${file}:${String(i + 1)}`,
        text: text.trim(),
      }))
      .filter(({ text }) => /^(-\s*)?uses:\s*[^.\s]/.test(text)),
  );

const dependabot = () =>
  existsSync(DEPENDABOT) ? readFileSync(DEPENDABOT, 'utf8') : '';

/**
 * The config with its YAML comments removed. ASSERT ON THIS, never on the
 * raw text.
 *
 * These checks read source text, and this file DOCUMENTS the very patterns it
 * is checked for — the sub-path note spells out `patterns: ["actions/cache*"]`
 * verbatim. Matched against the raw text, that prose SATISFIES the sub-path
 * guard on its own: the repo could reference `actions/cache` at three
 * sub-paths with no group whatsoever and still go green.
 */
const configBody = () => withoutYamlComments(dependabot());

/**
 * Every external `uses` value in the PARSED workflows, job calls and steps
 * alike. Read independently of the line reader above, so a `uses:` written in
 * a form that reader cannot see is caught by the difference (Refs #82).
 */
const parsedUses = (): string[] =>
  workflowFiles().flatMap((file) => {
    const doc: unknown = parse(readFileSync(join(WORKFLOWS, file), 'utf8'));
    const jobs =
      isRecord(doc) && isRecord(doc.jobs) ? Object.values(doc.jobs) : [];
    return jobs.flatMap((job) => {
      if (!isRecord(job)) return [];
      const steps: unknown[] = Array.isArray(job.steps) ? job.steps : [];
      return [
        job.uses,
        ...steps.map((step) => (isRecord(step) ? step.uses : undefined)),
      ]
        .filter((uses): uses is string => typeof uses === 'string')
        .filter((uses) => !uses.startsWith('./'));
    });
  });

/** Every `owner/repo` the workflows reference, with the distinct refs seen for each. */
const actionRepos = (): [string, Set<string>][] => {
  const refs = new Map<string, Set<string>>();
  for (const { text } of externalUses()) {
    const ref = text.match(/uses:\s*([^@\s]+)@/)?.[1];
    if (!ref) continue;
    const [owner = '', repo = ''] = ref.split('/');
    const key = `${owner}/${repo}`;
    const seen = refs.get(key) ?? new Set<string>();
    seen.add(ref);
    refs.set(key, seen);
  }
  return [...refs.entries()];
};

/**
 * True for an `owner/repo` referenced at MORE THAN ONE sub-path: one that
 * Dependabot would otherwise bump one sub-path at a time, leaving the
 * siblings behind.
 */
const isSubPath = ([, seen]: [string, Set<string>]): boolean => seen.size > 1;

describe('the CI supply chain is pinned', () => {
  it('there is something to check', () => {
    // Measured 6 at b2a6f3f (#82). Lower it only in the commit that removes one.
    expect(externalUses().length).toBeGreaterThan(5);
  });

  it('the line reader sees every uses: the parsed workflows hold (Refs #82)', () => {
    const read = externalUses().map(
      ({ text }) => text.match(/uses:\s*["']?([^\s"']+)/)?.[1] ?? text,
    );
    expect(read.sort()).toEqual(parsedUses().sort());
  });

  it('every third-party action is pinned to a full commit SHA', () => {
    const uses = externalUses();
    const unpinned = uses
      .filter(({ text }) => !/@[0-9a-f]{40}(?=\s|$)/.test(text))
      .map(({ where, text }) => `${where} ${text}`);

    expect(unpinned, 'a mutable tag can be repointed under us').toEqual([]);
  });

  it('every pinned action names the version its SHA resolves to', () => {
    const uses = externalUses();
    const opaque = uses
      .filter(({ text }) => !/@[0-9a-f]{40}\s+#\s*v\d/.test(text))
      .map(({ where, text }) => `${where} ${text}`);

    expect(opaque, 'a bare SHA bump is unreviewable by a human').toEqual([]);
  });
});

/** Every container and service image a workflow job runs, by job. */
const containerImages = () =>
  workflowFiles().flatMap((file) => {
    const doc: unknown = parse(readFileSync(join(WORKFLOWS, file), 'utf8'));
    const jobs = isRecord(doc) && isRecord(doc.jobs) ? doc.jobs : {};
    return Object.entries(jobs).flatMap(([id, job]) => {
      if (!isRecord(job)) return [];
      const services = isRecord(job.services)
        ? Object.values(job.services)
        : [];
      return [job.container, ...services]
        .map((c) => (isRecord(c) ? c.image : c))
        .filter((image): image is string => typeof image === 'string')
        .map((image) => ({ where: `${file}: jobs.${id}`, image }));
    });
  });

const lockedVersion = (name: string): unknown => {
  const lock: unknown = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const packages =
    isRecord(lock) && isRecord(lock.packages) ? lock.packages : {};
  const entry = packages[`node_modules/${name}`];
  return isRecord(entry) ? entry.version : undefined;
};

describe('the browser image is pinned and matches the test runner (#44)', () => {
  it('there is an image to check: CI gets its browsers from one, in every job that runs them', () => {
    const images = containerImages()
      .map(({ image }) => image)
      .filter((image) => image.startsWith('mcr.microsoft.com/playwright:'));
    // One distinct pin: none is a miss, two would let the deploy-dev smoke
    // (#123) drift from the browsers build-and-test proved.
    expect(new Set(images).size).toBe(1);
  });

  it('every container image is pinned to a digest, not just a tag', () => {
    const images = containerImages();
    const unpinned = images
      .filter(({ image }) => !/@sha256:[0-9a-f]{64}$/.test(image))
      .map(({ where, image }) => `${where} ${image}`);
    expect(unpinned, 'a tag can be re-pushed under us').toEqual([]);
  });

  it('the Playwright image is the version of @playwright/test the lockfile installs', () => {
    const version = lockedVersion('@playwright/test');
    expect(version, 'positive control: the lockfile names it').toMatch(
      /^\d+\.\d+\.\d+$/,
    );
    const playwrightImages = containerImages().filter(({ image }) =>
      image.startsWith('mcr.microsoft.com/playwright:'),
    );
    const stale = playwrightImages
      .filter(
        ({ image }) =>
          !image.startsWith(
            `mcr.microsoft.com/playwright:v${String(version)}-`,
          ),
      )
      .map(({ where, image }) => `${where} ${image}`);
    expect(
      stale,
      `a browser build the runner was not made for fails to launch; move the tag to v${String(version)}-noble and re-read its digest from https://mcr.microsoft.com/v2/playwright/manifests/v${String(version)}-noble`,
    ).toEqual([]);
  });
});

describe('Dependabot keeps the pins from rotting', () => {
  /**
   * ShyTalk shipped this bug, so it is guarded here before it can happen.
   *
   * Dependabot treats `actions/cache`, `actions/cache/restore` and
   * `actions/cache/save` as three SEPARATE dependencies. Ungrouped, they
   * arrive as three PRs, each moving one sub-path's SHA while its siblings
   * lag — a one-SHA-per-repo violation by construction, and for codeql-action
   * a runtime version mismatch ("Loaded a configuration file for version
   * '4.36.3', but running version '4.37.1'"). ShyTalk's SHY-0226.
   *
   * Dormant today: this repo uses no sub-path actions. It fails the moment
   * one is added without a matching Dependabot group. Verified by mutation,
   * not by watching it pass.
   */
  it('reads every action repo the workflows use (Refs #82)', () => {
    // Measured 2 at b2a6f3f (#82): actions/checkout and actions/setup-node.
    expect(actionRepos().length).toBeGreaterThan(1);
  });

  it('an action repo used at more than one sub-path is grouped into one PR', () => {
    const config = configBody();
    // Searched over every action repo: the sub-path ones are drawn from them,
    // and there are none today (dormant, see above).
    const repos = actionRepos();
    const ungrouped = repos
      .filter(isSubPath)
      .filter(([key]) => !withoutYamlQuotes(config).includes(`${key}*`))
      .map(
        ([key, refs]) =>
          `${key} used at ${String(refs.size)} sub-paths, ungrouped`,
      );

    expect(
      ungrouped,
      'separate PRs per sub-path break the one-SHA-per-repo invariant',
    ).toEqual([]);
  });

  it('a Dependabot config exists', () => {
    expect(existsSync(DEPENDABOT)).toBe(true);
  });

  it('watches npm AND the GitHub Actions themselves', () => {
    const config = configBody();

    expect(config, 'npm dependencies unwatched').toMatch(
      /package-ecosystem:\s*["']?npm["']?/,
    );
    expect(config, 'the actions that run CI are unwatched').toMatch(
      /package-ecosystem:\s*["']?github-actions["']?/,
    );
  });

  it('opens every PR against develop, never straight at main', () => {
    const config = configBody();
    const ecosystems = (config.match(/package-ecosystem:/g) ?? []).length;
    const onDevelop = config.match(/target-branch:\s*["']?develop["']?/g) ?? [];

    // Measured 2 at b2a6f3f (#82): npm and github-actions.
    expect(ecosystems, 'ecosystems declared').toBeGreaterThan(1);
    expect(
      onDevelop.length,
      'an ecosystem defaults to the default branch, bypassing the develop gate',
    ).toBe(ecosystems);
    const onMain = config.match(/target-branch:\s*["']?main["']?/g) ?? [];
    expect(onMain).toEqual([]);
  });

  /**
   * #501: type definitions never run ahead of the Node they describe.
   * Dependabot offered `@types/node` 26 (#493) while the toolchain ran 24,
   * which types APIs the runtime lacks. Parsed, not read as text, so the
   * comment above the rule cannot satisfy it.
   */
  it('does not offer @types/node majors above the Dockerfile line', () => {
    const doc: unknown = parse(dependabot());
    const updates =
      isRecord(doc) && Array.isArray(doc.updates) ? doc.updates : [];
    const npm = updates.filter(
      (u) => isRecord(u) && u['package-ecosystem'] === 'npm',
    );
    expect(npm, 'one npm entry').toHaveLength(1);
    const entry: unknown = npm[0];
    const ignore =
      isRecord(entry) && Array.isArray(entry.ignore) ? entry.ignore : [];
    // The Dockerfile holds an exact version (#785, #793); semver throws on anything else.
    const node = readFileSync('.github/node/Dockerfile', 'utf8')
      .trim()
      .replace(/^FROM node:/, '');
    const above = `>=${String(semver.major(node) + 1)}.0.0`;
    expect(ignore).toContainEqual({
      'dependency-name': '@types/node',
      versions: [above],
    });
  });
});

/**
 * The install is reproducible (Refs #1).
 *
 * The first CI run on develop died in `actions/setup-node` before a single
 * test ran: `cache: 'npm'` needs a lock file, and the template shipped none.
 * Without one, `npm ci` refuses too, and every install would resolve the
 * ranges afresh. The template also tracked a Vitest cache under
 * `node_modules/`, so a clean checkout carried build state.
 */
interface PackageJson {
  name: string;
  devDependencies: Record<string, string>;
}

interface PackageLock {
  lockfileVersion: number;
  name: string;
  packages: Record<string, { devDependencies?: Record<string, string> }>;
}

describe('the install is reproducible', () => {
  const pkg = () =>
    JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;

  it('the package is named for this repo, not the template', () => {
    expect(pkg().name).toBe('yawelo-idle');
  });

  it('a lock file is committed and agrees with package.json', () => {
    expect(
      existsSync('package-lock.json'),
      'npm ci and the CI cache need it',
    ).toBe(true);
    const lock = JSON.parse(
      readFileSync('package-lock.json', 'utf8'),
    ) as PackageLock;
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.name).toBe(pkg().name);
    expect(lock.packages['']?.devDependencies).toEqual(pkg().devDependencies);
  });
});

/**
 * No dependency runs an install script (#788, Shyden's route (b), 2026-11-07).
 *
 * npm 11 reads `allowScripts`: `true` lets a package's install script run,
 * and a bare name approves every future version, so a new esbuild or workerd
 * release would run its script on an approval given to an older one. Denying
 * every script removes that reach at a measured cost of about 0.05 s per
 * start (the JavaScript launcher instead of the native binary; table on
 * #788). A key with a version, range or dist-tag would leave every other
 * version unnamed, so each key is a bare name, and each is denied.
 */
const allowScripts = (): Record<string, unknown> => {
  const doc: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  return isRecord(doc) && isRecord(doc.allowScripts) ? doc.allowScripts : {};
};

const BARE_PACKAGE_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;

const lockedInstallScripts = (): string[] => {
  const lock: unknown = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const packages =
    isRecord(lock) && isRecord(lock.packages) ? lock.packages : {};
  return Object.entries(packages)
    .filter(
      ([path, entry]) =>
        // The root and the workspaces are this repo's own scripts, not a
        // dependency's.
        path.includes('node_modules/') &&
        isRecord(entry) &&
        entry.hasInstallScript === true,
    )
    .map(([path]) =>
      path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
    );
};

describe('no dependency runs an install script (#788)', () => {
  it('the lockfile holds packages with install scripts to check', () => {
    expect(lockedInstallScripts().length).toBeGreaterThan(0);
  });

  it.each(Object.keys(allowScripts()))(
    'allowScripts names %s bare, never with a version, range or dist-tag',
    (key) => {
      expect(key).toMatch(BARE_PACKAGE_NAME);
    },
  );

  it.each(Object.keys(allowScripts()))('allowScripts denies %s', (key) => {
    expect(allowScripts()[key], `${key} must be false, not approved`).toBe(
      false,
    );
  });

  it.each(lockedInstallScripts())(
    'allowScripts names %s, which the lockfile says has an install script',
    (name) => {
      expect(Object.keys(allowScripts())).toContain(name);
    },
  );
});

/**
 * The coverage tool is pinned to the test runner (#728). `@vitest/coverage-v8`
 * peers on one exact Vitest version, and Vitest warns that "running mixed
 * versions is not supported" when they differ. So a Vitest bump that leaves
 * the coverage package behind fails here, and Dependabot moves them together.
 */
const npmUpdate = (): Record<string, unknown> => {
  const doc: unknown = parse(dependabot());
  const updates =
    isRecord(doc) && Array.isArray(doc.updates) ? doc.updates : [];
  const npm: unknown = updates.find(
    (u) => isRecord(u) && u['package-ecosystem'] === 'npm',
  );
  return isRecord(npm) ? npm : {};
};

const stringsAt = (record: unknown, key: string): unknown[] =>
  isRecord(record) && Array.isArray(record[key]) ? record[key] : [];

describe('the coverage tool is pinned to the test runner (#728)', () => {
  it('package.json names @vitest/coverage-v8 at the installed Vitest version, exactly', () => {
    const installed = lockedVersion('vitest');
    expect(installed, 'positive control: the lockfile names vitest').toMatch(
      /^\d+\.\d+\.\d+$/,
    );
    const manifest = JSON.parse(
      readFileSync('package.json', 'utf8'),
    ) as PackageJson;
    expect(manifest.devDependencies['@vitest/coverage-v8']).toBe(installed);
  });

  it('the lockfile installs @vitest/coverage-v8 at the installed Vitest version', () => {
    expect(lockedVersion('@vitest/coverage-v8')).toBe(lockedVersion('vitest'));
  });

  it('Dependabot moves vitest and every @vitest package in one group', () => {
    const groups = npmUpdate()['groups'];
    const vitest = isRecord(groups) ? groups['vitest'] : undefined;
    expect(stringsAt(vitest, 'patterns')).toEqual(['vitest', '@vitest/*']);
  });

  it("the patch catch-all excludes the vitest group's patterns, since Dependabot scores groups and order decides nothing", () => {
    const groups = npmUpdate()['groups'];
    const patch = isRecord(groups) ? groups['patch-updates'] : undefined;
    expect(stringsAt(patch, 'exclude-patterns')).toEqual([
      'vitest',
      '@vitest/*',
    ]);
  });
});

/**
 * Dependabot scores groups, and the order they are written in decides
 * nothing (global rule 2026-10-20, #705). So every group with no `patterns`
 * (a catch-all such as `patch-updates`) lists every pattern group's patterns
 * under `exclude-patterns`, or it can swallow a dependency that group exists
 * to hold together.
 */
const ECOSYSTEMS = ['npm', 'github-actions'] as const;

const updateFor = (ecosystem: string): Record<string, unknown> => {
  const doc: unknown = parse(dependabot());
  const updates =
    isRecord(doc) && Array.isArray(doc.updates) ? doc.updates : [];
  const found: unknown = updates.find(
    (u) => isRecord(u) && u['package-ecosystem'] === ecosystem,
  );
  return isRecord(found) ? found : {};
};

describe('every catch-all group excludes every pattern group (#705)', () => {
  it('names each ecosystem dependabot.yml carries', () => {
    const doc: unknown = parse(dependabot());
    const updates: unknown[] =
      isRecord(doc) && Array.isArray(doc.updates) ? doc.updates : [];
    expect(
      updates.map((u): unknown => (isRecord(u) ? u['package-ecosystem'] : u)),
    ).toEqual([...ECOSYSTEMS, 'docker']);
  });

  it.each(ECOSYSTEMS)(
    '%s: every group with no patterns excludes every other group’s patterns',
    (ecosystem) => {
      const groups = updateFor(ecosystem)['groups'];
      const entries = isRecord(groups) ? Object.entries(groups) : [];
      const patterns = entries.flatMap(([, g]) => stringsAt(g, 'patterns'));
      const catchAlls = entries.filter(
        ([, g]) => stringsAt(g, 'patterns').length === 0,
      );
      expect(
        catchAlls.length,
        'positive control: a catch-all group',
      ).toBeGreaterThan(0);
      expect(
        patterns.length,
        'positive control: a pattern group',
      ).toBeGreaterThan(0);
      const missing = catchAlls.flatMap(([name, g]) =>
        patterns
          .filter((p) => !stringsAt(g, 'exclude-patterns').includes(p))
          .map((p) => `${name} does not exclude ${String(p)}`),
      );
      expect(missing).toEqual([]);
    },
  );
});

describe('Dependabot bumps the Node pin (#793)', () => {
  it('watches the Dockerfile for develop and never offers a new Node major', () => {
    expect(updateFor('docker')).toEqual({
      'package-ecosystem': 'docker',
      directory: '/.github/node',
      'target-branch': 'develop',
      schedule: { interval: 'weekly' },
      ignore: [
        {
          'dependency-name': 'node',
          'update-types': ['version-update:semver-major'],
        },
      ],
    });
  });
});
