import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { devices, type PlaywrightTestConfig } from '@playwright/test';
import enginesConfig from '../../playwright.engines.config';
import { webSmokeConfig } from '../../playwright.web.config';
import { siteSmokeConfig } from '../site/smoke-config';
import {
  ASSERTION_COUNTS_REPORTER,
  BROWSER_TARGETS,
  TARGET_TOTALS_REPORTER,
} from '../browser-targets';

/**
 * One suite, run unchanged on every target (#883 AC1, AC2). The targets are
 * written once, in tests/browser-targets.ts, and listed in the design spec
 * (§12); every Playwright config runs exactly those projects, with nothing
 * that would run a different set of tests on one of them.
 */

const DEV = {
  WEB_SMOKE_URL: 'https://dev.yaweloidle.com/',
  SITE_SMOKE_URL: 'https://dev.shyden.co.uk/',
  DEV_BASIC_AUTH_PASSWORD: 'the dev password',
};

/** A desktop target runs untagged and @desktop tests, never @phone ones (#996). */
const DESKTOP = { metadata: { group: 'desktop' }, grepInvert: /@phone\b/ };

const CONFIGS: [string, PlaywrightTestConfig][] = [
  ['the cross-engine check', enginesConfig],
  ['the web suite, local', webSmokeConfig({})],
  ['the web suite, against dev', webSmokeConfig(DEV)],
  ['the site suite, against dev', siteSmokeConfig(DEV)],
];

describe('the supported targets (#883 AC1)', () => {
  it('are the three desktop engines only: no desktop browser emulates a phone (#995)', () => {
    expect(BROWSER_TARGETS).toEqual([
      { name: 'chromium', use: devices['Desktop Chrome'], ...DESKTOP },
      { name: 'firefox', use: devices['Desktop Firefox'], ...DESKTOP },
      { name: 'webkit', use: devices['Desktop Safari'], ...DESKTOP },
    ]);
  });

  it('declare the desktop group and leave out only @phone tests (#996)', () => {
    expect(BROWSER_TARGETS.map((t) => t.metadata)).toEqual(
      BROWSER_TARGETS.map(() => ({ group: 'desktop' })),
    );
    expect(BROWSER_TARGETS.map((t) => String(t.grepInvert))).toEqual(
      BROWSER_TARGETS.map(() => '/@phone\\b/'),
    );
  });

  it.each(BROWSER_TARGETS.map((t) => [t.name] as const))(
    'lists %s in the design spec’s testing section',
    (name) => {
      const spec = readFileSync(
        'docs/superpowers/specs/2026-10-01-yawelo-idle-design.md',
        'utf8',
      );
      const testing = spec.slice(
        spec.indexOf('## 12. Testing and quality'),
        spec.indexOf('## 13. Delivery'),
      );
      expect(testing).toMatch(new RegExp(`^\\s+- \`${name}\`: `, 'm'));
    },
  );

  it('lists no target in the spec that the list lacks', () => {
    const spec = readFileSync(
      'docs/superpowers/specs/2026-10-01-yawelo-idle-design.md',
      'utf8',
    );
    const block = spec.slice(
      spec.indexOf('**Supported browser targets'),
      spec.indexOf('## 13. Delivery'),
    );
    const listed = [...block.matchAll(/^\s+- `([a-z-]+)`: /gm)].map(
      (m) => m[1],
    );
    expect(listed).toEqual(BROWSER_TARGETS.map((t) => t.name));
  });
});

describe.each(CONFIGS)('%s (#883 AC2, AC3)', (_label, config) => {
  // Exact equality also refuses any other per-target grep, testIgnore or
  // testMatch: a target carries its name, its device and its group's filter.
  it('runs every supported target, and only those, unfiltered', () => {
    expect(config.projects).toEqual(BROWSER_TARGETS);
  });

  it('prints each target’s total, fails when they differ, and counts each test’s assertions (#933)', () => {
    expect(config.reporter).toEqual([
      ['list'],
      [TARGET_TOTALS_REPORTER],
      [ASSERTION_COUNTS_REPORTER],
    ]);
  });
});
