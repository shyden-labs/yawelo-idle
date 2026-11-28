/**
 * Verifies the production front door from the outside after a release
 * deploys it (#1152; the door itself is #784 and #1078):
 *
 * 1. Each DEV door refuses a request with no pass (401).
 * 2. Each DEV door sends a page visit with no pass to the DEV sign-in, for
 *    that door, back to the page asked for.
 * 3. The TEST door forwards with no check (200).
 *
 * The doors come from the door's own list (apps/door/worker/doors.ts), so a
 * new door is checked too. A DEV door forwarding a valid pass is checked by
 * every dev deploy's smoke, which reaches dev.yaweloidle.com with a machine
 * pass. Each door is asked once: a Worker deploy is live when wrangler
 * returns, so nothing here waits.
 *
 *     node scripts/verify-door.ts
 */
import { DOORS } from '../apps/door/worker/doors.ts';
import { probe, type Probe } from './verify-dev.ts';

/**
 * The DEV sign-in. Plain Node cannot load the Worker's dev-pass/door.ts (its
 * imports have no extension), so the address is held here and a unit test
 * pins it to that file's SIGNIN_ORIGIN.
 */
export const SIGNIN_ORIGIN = 'https://dev-signin.shyden.co.uk';

/** How one door answered a plain request and a page visit, neither with a pass. */
export interface DoorAnswer {
  plain: Probe;
  page: Probe;
}
export type DoorAnswers = Partial<Record<string, DoorAnswer>>;

/** Fetches one URL with headers, never following a redirect; a stand-in in the tests. */
export type DoorLook = (
  url: string,
  headers: Record<string, string>,
) => Promise<Probe>;

/** What a browser's top-level navigation carries, which the door reads as a page visit. */
const PAGE_HEADERS: Readonly<Record<string, string>> = {
  accept: 'text/html',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document',
};

const hosts = (environment: 'dev' | 'test'): string[] =>
  [...DOORS]
    .filter(([, door]) => door.environment === environment)
    .map(([host]) => host);

/** Where a DEV door sends a page visit to its root with no pass. */
function signinFor(host: string): string {
  const signin = new URL('/pass', SIGNIN_ORIGIN);
  signin.search = new URLSearchParams({ for: host, back: '/' }).toString();
  return signin.toString();
}

function devProblems(host: string, answer: DoorAnswer): string[] {
  const problems: string[] = [];
  if (answer.plain.status !== 401)
    problems.push(
      `${host}: a request with no pass got ${String(answer.plain.status)}, expected 401`,
    );
  const expected = signinFor(host);
  if (answer.page.status !== 302)
    problems.push(
      `${host}: a page visit with no pass got ${String(answer.page.status)}, expected 302 to ${expected}`,
    );
  else {
    const location = answer.page.headers.get('location');
    if (location !== expected)
      problems.push(
        `${host}: a page visit with no pass went to ${location ?? 'nowhere'}, expected ${expected}`,
      );
  }
  return problems;
}

function testProblems(host: string, answer: DoorAnswer): string[] {
  return answer.plain.status === 200
    ? []
    : [
        `${host}: got ${String(answer.plain.status)}, expected 200 (TEST has no check)`,
      ];
}

/** Every problem the doors' answers show. */
export function doorProblems(answers: DoorAnswers): string[] {
  const problems: string[] = [];
  for (const host of hosts('dev')) {
    const answer = answers[host];
    if (answer !== undefined) problems.push(...devProblems(host, answer));
  }
  for (const host of hosts('test')) {
    const answer = answers[host];
    if (answer !== undefined) problems.push(...testProblems(host, answer));
  }
  return problems;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Asks every door, then judges every answer; a failed request is a problem naming its door. */
export async function verifyDoors(look: DoorLook): Promise<string[]> {
  const all = [...DOORS.keys()];
  const settled = await Promise.allSettled(
    all.map(async (host): Promise<DoorAnswer> => {
      const url = `https://${host}/`;
      const [plain, page] = await Promise.all([
        look(url, {}),
        look(url, { ...PAGE_HEADERS }),
      ]);
      return { plain, page };
    }),
  );
  const answers: DoorAnswers = {};
  const failures: string[] = [];
  settled.forEach((outcome, index) => {
    const host = all[index] as string;
    if (outcome.status === 'fulfilled') answers[host] = outcome.value;
    else failures.push(`${host}: request failed: ${message(outcome.reason)}`);
  });
  return [...failures, ...doorProblems(answers)];
}

/** What a run prints, and its exit code. */
export function doorVerdict(problems: readonly string[]): {
  code: number;
  lines: string[];
} {
  if (problems.length > 0)
    return {
      code: 1,
      lines: problems.map((problem) => `✗ front door: ${problem}`),
    };
  return {
    code: 0,
    lines: [
      `✓ front door: ${hosts('dev').join(', ')} refuse a request with no pass and send a page visit to the sign-in; ${hosts('test').join(', ')} forwards with no check`,
    ],
  };
}

/** Where a run's lines go. */
export interface Output {
  log: (line: string) => void;
  error: (line: string) => void;
}

/** One verify run; returns the exit code. */
export async function runDoorVerify(
  look: DoorLook,
  out: Output,
): Promise<number> {
  const { code, lines } = doorVerdict(await verifyDoors(look));
  for (const line of lines)
    if (code === 0) out.log(line);
    else out.error(line);
  return code;
}

if (import.meta.main) process.exitCode = await runDoorVerify(probe, console);
