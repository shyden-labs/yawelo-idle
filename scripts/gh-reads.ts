/**
 * Reading GitHub's replies in the pull-request gates (board-orphans #580,
 * develop-squash-only #679): each read names what it could not read, and a
 * reply that is not what `gh api --paginate --slurp` prints is refused.
 */

/** The error naming `what` could not be read, and why. */
const couldNotRead = (what: string, error: unknown): Error =>
  new Error(
    `could not read ${what}: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );

/** `what`'s value from `call`, or an error naming what could not be read. */
export function read<T>(what: string, call: () => T): T {
  try {
    return call();
  } catch (error) {
    throw couldNotRead(what, error);
  }
}

/** `read`, for a value that arrives later. */
export async function readLater<T>(
  what: string,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw couldNotRead(what, error);
  }
}

/** The entries of every page `gh api --paginate --slurp` printed. */
export function entries(out: string): unknown[] {
  const pages = JSON.parse(out) as unknown;
  if (!Array.isArray(pages) || !pages.every(Array.isArray))
    throw new Error('the reply is not a list of pages');
  return (pages as unknown[][]).flat();
}

export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null;
