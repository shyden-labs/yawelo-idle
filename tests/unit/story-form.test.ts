import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The story form is repo-template's (#742, shyden-labs/repo-template#20:
 * every project files a ticket the same way), keeping only what this repo's
 * rules need: the Website section (CLAUDE.md, "Website follows the game")
 * and two Definition of done lines (a new guard seen failing once; Svelte
 * screens tested in full, #804 and #806). It asks for what the board orders
 * work by (#576) and records blockers as "Blocked by" links (#577).
 */

interface FormItem {
  type: string;
  id?: string;
  attributes?: { value?: string; description?: string };
  validations?: { required?: boolean };
}

const form = (): FormItem[] =>
  (
    parse(
      readFileSync(
        new URL('../../.github/ISSUE_TEMPLATE/story.yml', import.meta.url),
        'utf8',
      ),
    ) as { body: FormItem[] }
  ).body;

const item = (id: string): FormItem => {
  const found = form().filter((i) => i.id === id);
  expect(found).toHaveLength(1);
  return found[0] ?? { type: '' };
};

const NOTE = `Every project files a ticket the same way (shyden-labs/repo-template#20):
1. **Search the open board first.** On a duplicate, add what is new to the original instead.
2. **Add the issue to the "Yawelo Idle Stories" board**, checking the board’s title before you write.
3. Set the board’s **Estimate** field: 1, 2, 3, 5, 8 or 13 story points. It is scored from the acceptance criteria against similar closed stories, never from felt hours. Anything larger is an epic: split it into stories. Progress by effort reads the board field and nothing else.
4. Set its **Priority** too: P0 (now) to P5 (someday), as the board’s option descriptions define them. A blocker takes at least the level of what waits on it. The next ticket comes from \`node scripts/board-next.ts\`, never from the handover.
5. Add a **Blocked by** link for each issue it waits on: a “Depends on” section is context, not the record.
6. Set its epic as its **parent**.
7. Write \`Refs #N\` in commits and pull requests, never a closing keyword; close it by hand once every criterion is verified.

\`node scripts/file-story.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories" <story.json>\` does steps 1 to 6.
`;

describe('the story form is the template’s (#742)', () => {
  it('holds the template’s fields in order, Website standing for Announce', () => {
    expect(form().map((i) => `${i.type} ${i.id ?? ''}`)).toEqual([
      'markdown filing-steps',
      'textarea story',
      'textarea context',
      'textarea acceptance-criteria',
      'textarea website',
      'textarea definition-of-done',
    ]);
  });

  it('requires every section', () => {
    expect(
      form()
        .filter((i) => i.type === 'textarea')
        .map((i) => i.validations?.required),
    ).toEqual([true, true, true, true, true]);
  });

  it('shows the template’s filing steps, for this board', () => {
    expect(item('filing-steps').attributes?.value).toBe(NOTE);
  });

  it('asks Context for the template’s wording', () => {
    expect(item('context').attributes?.description).toBe(
      'The spec sections, decisions and research it rests on, and what it waits on.',
    );
  });

  it('keeps the template’s done lines, plus the two this repo needs', () => {
    expect(item('definition-of-done').attributes?.value).toBe(
      [
        '- Every new test written first and seen red for the stated reason.',
        '- Every new guard seen failing once when written.',
        "- Every new or changed Svelte screen's behaviour tested in full: every statement, branch and handler run by a test (the coverage job fails otherwise, #804), driven in jsdom with clicks as packages/ui/test/Counter.test.ts does (#806).",
        '- Lint, typecheck, formatting and the zero-warnings gate pass; no retries; one test per case.',
        '- CI green on the PR head SHA, read step by step by name; merged into `develop` and deployed to dev, verified.',
        '',
      ].join('\n'),
    );
  });
});
