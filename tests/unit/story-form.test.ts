import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The story form asks for what the board orders work by (#576): an Estimate
 * and a Priority, and for blockers as "Blocked by" links (#577).
 */

interface FormItem {
  type: string;
  id?: string;
  attributes?: { value?: string };
}

/** The note shown above the form, which says what to set on the board, read inside the test. */
function note(): string {
  const form = parse(
    readFileSync(
      new URL('../../.github/ISSUE_TEMPLATE/story.yml', import.meta.url),
      'utf8',
    ),
  ) as { body: FormItem[] };
  const found = form.body.filter((i) => i.id === 'estimate-note');
  expect(found).toHaveLength(1);
  return found[0]?.attributes?.value ?? '';
}

describe('the story form (#576)', () => {
  it('asks for the Estimate on the board', () => {
    expect(note()).toContain(
      'set its **Estimate** field: 1, 2, 3, 5, 8 or 13 story points',
    );
  });

  it('asks for the Priority beside it, P0 to P5', () => {
    expect(note()).toContain(
      'Set its **Priority** too: P0 (now) to P5 (someday), as the board’s option descriptions define them. A blocker takes at least the level of what waits on it.',
    );
  });
});
