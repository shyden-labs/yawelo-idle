import { describe, expect, it } from 'vitest';
import { versionFor } from '../../scripts/prod-version';

/**
 * Finding the production Worker version a rollback returns to (#621 AC6):
 * each deploy is tagged with its commit (`wrangler deploy --tag`), and
 * `wrangler versions list --json` reports the tag as
 * `annotations["workers/tag"]` (read in wrangler 4.148's own source).
 */
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const version = (id: string, tag: string | undefined): unknown => ({
  id,
  annotations: tag === undefined ? {} : { 'workers/tag': tag },
});

describe('the version a rollback returns to', () => {
  it('is the one version tagged with the commit', () => {
    expect(versionFor([version('v1', A), version('v2', B)], A)).toBe('v1');
  });

  it('refuses a commit no version carries, naming the tags it saw', () => {
    expect(() =>
      versionFor([version('v2', B), version('v3', undefined)], A),
    ).toThrow(`no version is tagged ${A}; tags seen: ${B}, (none)`);
  });

  it('refuses a commit two versions carry', () => {
    expect(() => versionFor([version('v1', A), version('v4', A)], A)).toThrow(
      `2 versions are tagged ${A}: v1, v4`,
    );
  });

  it('refuses a listing that is not an array of versions', () => {
    expect(() => versionFor({ versions: [] }, A)).toThrow(
      'not a list of versions',
    );
  });

  it('refuses a version with no id', () => {
    expect(() =>
      versionFor([{ annotations: { 'workers/tag': A } }], A),
    ).toThrow('a version has no id');
  });

  it('refuses a commit that is not a full 40-character SHA', () => {
    expect(() => versionFor([version('v1', A)], 'abc123')).toThrow(
      'abc123 is not a full commit SHA',
    );
  });
});
