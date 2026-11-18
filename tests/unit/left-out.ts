/** Each way Playwright, or Vitest's API it shares, can leave a test out. */
const LEAVES_OUT =
  /\.(?:skip|fixme|todo|skipIf|runIf)\b|\bgrepInvert\b|\btestIgnore\b/;

/**
 * Every line of `text` that leaves a test out of a run, as
 * `file:line: text` (#883 AC4): a browser test runs on every target or is
 * removed, never skipped.
 */
export function leftOut(file: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, i) =>
      LEAVES_OUT.test(line) ? [`${file}:${String(i + 1)}: ${line.trim()}`] : [],
    );
}
