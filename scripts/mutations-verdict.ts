/**
 * `node scripts/mutations-verdict.ts` (#619 AC5): the `mutations` job, which
 * is develop's required check. It runs whatever happened in the jobs above
 * it (`!cancelled()`), reads their results from the environment (`CHANGED`,
 * `COUNT`, `RUN`) and passes only when the judge passed and either listed no
 * file and the run job was skipped, or the run job ran the listed files
 * clean. A failed judge skips the run job, so a check reading the run job
 * alone would pass it.
 */

export interface Results {
  /** The `changed` job's result: the judge. */
  readonly changed: string;
  /** How many mutation files the judge listed, as it wrote it. */
  readonly count: string;
  /** The `run` job's result. */
  readonly run: string;
}

const files = (n: number): string =>
  `${String(n)} mutation file${n === 1 ? '' : 's'}`;

/** Whether the check passes, and the line saying why. */
export function verdict(results: Results): {
  readonly ok: boolean;
  readonly line: string;
} {
  const { changed, count, run } = results;
  if (changed !== 'success')
    return {
      ok: false,
      line: `✗ the judge ended ${changed}: read its log for each finding`,
    };
  if (!/^(0|[1-9][0-9]*)$/.test(count))
    return {
      ok: false,
      line: `✗ the judge passed but wrote no count it can read: ${JSON.stringify(count)}`,
    };
  const n = Number(count);
  if (n === 0)
    return run === 'skipped'
      ? { ok: true, line: '✓ the judge passed and listed no mutation file' }
      : {
          ok: false,
          line: `✗ the run job ran ${run} with no mutation file listed`,
        };
  return run === 'success'
    ? { ok: true, line: `✓ the judge passed and ${files(n)} ran clean` }
    : { ok: false, line: `✗ the run of ${files(n)} ended ${run}` };
}

if (import.meta.main) {
  const result = verdict({
    changed: process.env.CHANGED ?? '',
    count: process.env.COUNT ?? '',
    run: process.env.RUN ?? '',
  });
  console.log(result.line);
  process.exitCode = result.ok ? 0 : 1;
}
