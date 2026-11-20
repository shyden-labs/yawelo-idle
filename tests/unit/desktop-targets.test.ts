import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PlaywrightTestConfig } from '@playwright/test';
import { desktopProjects } from '@shyden-labs/playwright-devices/desktop';
import enginesConfig from '../../playwright.engines.config';
import { webSmokeConfig } from '../../playwright.web.config';
import { siteSmokeConfig } from '../site/smoke-config';
import { DESKTOP_BROWSERS } from '../desktop-targets';

/**
 * One suite, run unchanged on every desktop browser (#883, #1003). The
 * browsers and their setup come from shyden-labs/playwright-devices, so every
 * project runs the same desktop group; Yawelo only names which of them it
 * runs, in tests/desktop-targets.ts, listed in the design spec (§12).
 */

const DEV = {
  WEB_SMOKE_URL: 'https://dev.yaweloidle.com/',
  SITE_SMOKE_URL: 'https://dev.shyden.co.uk/',
  DEV_BASIC_AUTH_PASSWORD: 'the dev password',
};

const SPEC = 'docs/superpowers/specs/2026-10-01-yawelo-idle-design.md';

describe('the desktop browsers (#1003)', () => {
  it('are Chromium, Firefox, WebKit and Edge (#1003 AC3)', () => {
    expect(DESKTOP_BROWSERS).toEqual([
      'chromium',
      'firefox',
      'webkit',
      'msedge',
    ]);
  });

  it('come from shyden-labs/playwright-devices, taking every newer release (#1003 AC1)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies['@shyden-labs/playwright-devices']).toMatch(
      /^>=\d+\.\d+\.\d+$/,
    );
  });

  it.each(DESKTOP_BROWSERS.map((name) => [name] as const))(
    'lists %s in the design spec’s testing section',
    (name) => {
      const spec = readFileSync(SPEC, 'utf8');
      const testing = spec.slice(
        spec.indexOf('## 12. Testing and quality'),
        spec.indexOf('## 13. Delivery'),
      );
      expect(testing).toMatch(new RegExp(`^\\s+- \`${name}\`: `, 'm'));
    },
  );

  it('lists no browser in the spec that the list lacks', () => {
    const spec = readFileSync(SPEC, 'utf8');
    const block = spec.slice(
      spec.indexOf('**Supported browser targets'),
      spec.indexOf('## 13. Delivery'),
    );
    const listed = [...block.matchAll(/^\s+- `([a-z-]+)`: /gm)].map(
      (m) => m[1],
    );
    expect(listed).toEqual([...DESKTOP_BROWSERS]);
  });
});

/** The reporters each suite writes for the shared one-suite check. */
function reporters(suite: string): PlaywrightTestConfig['reporter'] {
  return [
    ['list'],
    ['json', { outputFile: `one-suite/${suite}/report.json` }],
    [
      '@shyden-labs/playwright-devices/assertion-counter',
      {
        outputFile: `one-suite/${suite}/assertions.json`,
        unnamedTarget: 'desktop',
      },
    ],
  ];
}

const CONFIGS: [string, PlaywrightTestConfig, string][] = [
  ['the cross-engine check', enginesConfig, 'engines'],
  ['the web suite, local', webSmokeConfig({}), 'web'],
  ['the web suite, against dev', webSmokeConfig(DEV), 'web'],
  ['the site suite, against dev', siteSmokeConfig(DEV), 'site'],
];

describe.each(CONFIGS)('%s (#1003 AC1, AC2)', (_label, config, suite) => {
  // Exact equality also refuses any per-browser grep, testIgnore or testMatch.
  it('runs the shared setup of every desktop browser, unfiltered', () => {
    expect(config.projects).toEqual(desktopProjects(DESKTOP_BROWSERS));
  });

  it('writes the report and assertion counts the shared check reads', () => {
    expect(config.reporter).toEqual(reporters(suite));
  });
});
