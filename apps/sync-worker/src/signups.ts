/**
 * The sign-up switch (#1079; global rule, Shyden 2026-11-22,
 * shyden-labs/repo-template#207): the Worker variable `SIGNUPS`, "open" or
 * "closed", per environment, changeable in Cloudflare's dashboard without
 * new code. Anything but "open" is closed, so a missing or mistyped value
 * never opens sign-ups; a value that is neither is named once in the log.
 */
let warned = false;

export function signupsOpen(value: string | undefined): boolean {
  if (value === 'open') return true;
  if (value !== 'closed' && !warned) {
    warned = true;
    console.error(
      'SIGNUPS is neither "open" nor "closed": new sign-ups are closed',
    );
  }
  return false;
}

/** For tests: forget that the warning was logged. */
export function resetSignupsWarning(): void {
  warned = false;
}
