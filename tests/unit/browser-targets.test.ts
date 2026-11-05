import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { devices, type PlaywrightTestConfig } from '@playwright/test';
import enginesConfig from '../../playwright.engines.config';
import { webSmokeConfig } from '../../playwright.web.config';
import { siteSmokeConfig } from '../site/smoke-config';
import { BROWSER_TARGETS, TARGET_TOTALS_REPORTER } from '../browser-targets';

/**
 * One suite, run unchanged on every target (#883 AC1, AC2). The targets are
 * written once, in tests/browser-targets.ts, and listed in the design spec
 * (§12); every Playwright config runs exactly those projects, with nothing
 * that would run a different set of tests on one of them.
 */

const DEV = {
  WEB_SMOKE_URL: 'https://dev.yawelo-idle.shyden.co.uk/',
  SITE_SMOKE_URL: 'https://dev.shyden.co.uk/',
  DEV_BASIC_AUTH_PASSWORD: 'the dev password',
};

const CONFIGS: [string, PlaywrightTestConfig][] = [
  ['the cross-engine check', enginesConfig],
  ['the web suite, local', webSmokeConfig({})],
  ['the web suite, against dev', webSmokeConfig(DEV)],
  ['the site suite, against dev', siteSmokeConfig(DEV)],
];

describe('the supported targets (#883 AC1)', () => {
  it('are the three desktop engines and two touch phones, from #323', () => {
    expect(BROWSER_TARGETS).toEqual([
      { name: 'chromium', use: devices['Desktop Chrome'] },
      { name: 'firefox', use: devices['Desktop Firefox'] },
      { name: 'webkit', use: devices['Desktop Safari'] },
      { name: 'chromium-phone', use: devices['Pixel 7'] },
      { name: 'webkit-phone', use: devices['iPhone 14'] },
    ]);
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
  // Exact equality also refuses a per-target grep, testIgnore or testMatch:
  // a target carries its name and its device, nothing else.
  it('runs every supported target, and only those, unfiltered', () => {
    expect(config.projects).toEqual(BROWSER_TARGETS);
  });

  it('prints each target’s total and fails when they differ', () => {
    expect(config.reporter).toEqual([['list'], [TARGET_TOTALS_REPORTER]]);
  });
});
