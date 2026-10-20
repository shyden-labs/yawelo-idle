/**
 * How a daily check reports to Shyden (#687, #710): one issue per outage,
 * assigned to him, found again by its title while it is open. A check that
 * finds problems calls `report`, which comments on the issue already open,
 * or opens one only when none is.
 */
import type { Gh } from './board-progress.ts';
import { entries, isRecord } from './gh-reads.ts';

/** Who every daily check's issue is assigned to. */
export const ASSIGNEE = 'ShydenMcM';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The open issue (never a pull request) carrying `title`. */
function openReport(repo: string, gh: Gh, title: string): number | undefined {
  const found = entries(
    gh([
      'api',
      '--paginate',
      '--slurp',
      `repos/${repo}/issues?state=open&per_page=100`,
    ]),
  ).find(
    (item) =>
      isRecord(item) && item.title === title && item.pull_request === undefined,
  );
  return isRecord(found) && typeof found.number === 'number'
    ? found.number
    : undefined;
}

/** One outage, as its issue reads. */
export interface Outage {
  /** The issue's title, unique to the check and the outage. */
  title: string;
  /** The first line of the body: which check found this. */
  lead: string;
  /** Each thing found wrong, one bullet each. */
  problems: readonly string[];
  /** The last paragraph: what the outage breaks for Shyden. */
  footer: string;
}

/**
 * Reports `outage` on the issue already open, or opens one assigned to
 * `ASSIGNEE` when none is. A failed search for the open issue still opens
 * one, and says so. The lines say what was done and what was found.
 */
export function report(repo: string, gh: Gh, outage: Outage): string[] {
  const notes: string[] = [];
  let open: number | undefined;
  try {
    open = openReport(repo, gh, outage.title);
  } catch (error) {
    notes.push(
      `could not search the open issues for an earlier report: ${message(error)}`,
    );
  }
  const body = [
    outage.lead,
    '',
    ...outage.problems.map((p) => `- ${p}`),
    ...notes.map((n) => `- ${n}`),
    '',
    outage.footer,
  ].join('\n');
  if (open === undefined) {
    gh([
      'api',
      '-X',
      'POST',
      `repos/${repo}/issues`,
      '-f',
      `title=${outage.title}`,
      '-f',
      `body=${body}`,
      '-f',
      `assignees[]=${ASSIGNEE}`,
    ]);
  } else {
    gh([
      'api',
      '-X',
      'POST',
      `repos/${repo}/issues/${String(open)}/comments`,
      '-f',
      `body=${body}`,
    ]);
  }
  return [
    open === undefined
      ? `Opened an issue for ${ASSIGNEE}:`
      : `Commented on #${String(open)}:`,
    ...outage.problems,
    ...notes,
  ];
}
