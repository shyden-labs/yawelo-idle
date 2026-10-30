import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY } from '../../apps/site/src/copy';
import {
  PROD_WRANGLER_CONFIGS,
  readDeployConfig,
  type DeployConfig,
} from './wrangler-configs';
import { headerRules, type HeaderRules } from '../../scripts/headers-file';

/**
 * The production holding page (#621): an assets-only Worker in the
 * production account, served at yawelo-idle.shyden.co.uk, with its security
 * headers, its robots file, its approved words and its video's terms.
 * Configs are read the way wrangler reads them (comments stripped), so no
 * comment can satisfy or trip a pin.
 */
const ROOT = new URL('../..', import.meta.url).pathname;
const HOLDING = join(ROOT, 'apps/site/holding');

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** The config fields that would run code or bind something to it. */
const CODE_FIELDS = [
  'main',
  'durable_objects',
  'triggers',
  'services',
  'd1_databases',
  'vars',
] as const satisfies readonly (keyof DeployConfig)[];

/** Whether a config value declares anything: a string, a number, or a container holding one. */
function holds(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some(holds);
  if (typeof value === 'object') return Object.values(value).some(holds);
  return true;
}

describe('the production holding page Worker (#621 AC2)', () => {
  it('is one production config, at the holding page', () => {
    expect([...PROD_WRANGLER_CONFIGS]).toEqual([
      'apps/site/holding/wrangler.jsonc',
    ]);
  });

  it('is the Worker yawelo-idle-site', () => {
    expect(readDeployConfig(join(HOLDING, 'wrangler.jsonc')).name).toBe(
      'yawelo-idle-site',
    );
  });

  it('runs no script and holds no binding, schedule or variable: assets only', () => {
    const config = readDeployConfig(join(HOLDING, 'wrangler.jsonc'));
    const declared = CODE_FIELDS.filter((field) => holds(config[field]));
    expect(declared).toEqual([]);
  });

  it('finds what the dev site Worker declares in those fields, so the check is alive', () => {
    const dev = readDeployConfig(join(ROOT, 'apps/site/wrangler.jsonc'));
    expect(CODE_FIELDS.filter((field) => holds(dev[field]))).toEqual([
      'main',
      'durable_objects',
      'triggers',
      'services',
      'vars',
    ]);
  });

  it('serves the built holding pages, with its own 404 page', () => {
    const config = readDeployConfig(join(HOLDING, 'wrangler.jsonc'));
    // Relative to this config, as wrangler reads it: apps/site/dist-holding.
    expect(config.assets).toEqual({
      directory: '../dist-holding',
      not_found_handling: '404-page',
    });
  });

  it('is reached only at yawelo-idle.shyden.co.uk, as a Custom Domain, with no workers.dev or preview address', () => {
    const config = readDeployConfig(join(HOLDING, 'wrangler.jsonc'));
    expect(config.routes).toEqual([
      { pattern: 'yawelo-idle.shyden.co.uk', custom_domain: true },
    ]);
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
  });
});

describe('the holding page’s security headers (#621 AC2)', () => {
  const rules = (): HeaderRules =>
    headerRules(read('apps/site/holding/public/_headers'));

  it('sets a content security policy with no inline script or style, taking images and media from the media host alone (#713), on every path', () => {
    expect(rules().get('/*')?.get('content-security-policy')).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src https://media.shyden.co.uk; media-src https://media.shyden.co.uk; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });

  it('stops MIME sniffing, referrer leaks and every powerful browser feature, on every path', () => {
    const all = rules().get('/*');
    expect(all?.get('x-content-type-options')).toBe('nosniff');
    expect(all?.get('referrer-policy')).toBe('no-referrer');
    expect(all?.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
  });

  // The media moved to media.shyden.co.uk (#713), whose zone rule sets
  // Cross-Origin-Resource-Policy: same-site; verify-prod checks it live.
  it('declares only the every-path rule, since the page serves no media of its own', () => {
    expect([...rules().keys()]).toEqual(['/*']);
  });
});

describe('the holding page’s robots file (#621 AC3)', () => {
  it('allows every crawler everywhere in production', () => {
    expect(read('apps/site/holding/public/robots.txt')).toBe(
      'User-agent: *\nAllow: /\n',
    );
  });
});

describe('the holding page’s words (#621 AC1)', () => {
  it('uses the approved English tagline (#334)', () => {
    expect(COPY.en.tagline).toBe('An idle adventure through a real language.');
  });

  it('uses the Indonesian tagline Shyden approved on 2026-10-16', () => {
    expect(COPY.id.tagline).toBe(
      'Petualangan idle menjelajahi bahasa sungguhan.',
    );
  });

  it('uses the Indonesian lines Shyden approved on 2026-10-16', () => {
    expect([
      COPY.id.comingSoon,
      COPY.id.notFoundTitle,
      COPY.id.notFoundBody,
      COPY.id.homeLink,
    ]).toEqual([
      'Segera hadir',
      'Halaman tidak ditemukan',
      'Tidak ada halaman di alamat ini.',
      'Kembali ke beranda',
    ]);
  });
});

describe('the promo video’s terms (#621)', () => {
  it('is listed as not licensed, all rights reserved', () => {
    expect(read('LICENSE-CONTENT.md')).toContain(
      'The promo video in `apps/site/media/` (all rights reserved, operator 2026-10-16)',
    );
  });
});
