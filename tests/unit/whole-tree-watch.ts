/**
 * The named whole-tree readers report to the unit setup (#530, #762):
 * `committableFiles`, `ignoredPaths` and `walkTree` call `wholeTreeRead` with
 * the root they read, and `isIgnored` runs inside `asIgnoreLookup`. The unit
 * setup registers the watcher that refuses a read of the checkout; a script
 * importing these readers registers none, and nothing is refused.
 *
 * The setup once wrapped the readers with `vi.mock`, which only Vite's module
 * runner keeps in order: under Node's own loader (the coverage runs, #762) a
 * mocked module's exports are filled in after the importing file's top level
 * runs, so a constant read there was `undefined`. A call inside each reader
 * works the same under either loader. It imports nothing, so the scripts load
 * it as they are.
 */

type Watcher = (reader: string, root: string) => void;

let watcher: Watcher | undefined;

/** The setup's watcher, called by every named whole-tree reader. */
export const watchWholeTree = (next: Watcher): void => {
  watcher = next;
};

/** Each named whole-tree reader calls this first, naming itself and its root. */
export const wholeTreeRead = (reader: string, root: string): void => {
  watcher?.(reader, root);
};

// `isIgnored` reads git's own record of the tree to answer one path, which
// #530 allows: the setup lets the git directory be read while one runs.
let lookups = 0;

/** Runs `read` as one ignore lookup: the git directory may be read meanwhile. */
export const asIgnoreLookup = <T>(read: () => T): T => {
  lookups += 1;
  try {
    return read();
  } finally {
    lookups -= 1;
  }
};

/** Whether an ignore lookup is running. */
export const inIgnoreLookup = (): boolean => lookups > 0;
