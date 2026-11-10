/**
 * The holding page's dev copy (#621 AC8): its files, served as they are.
 * Run before its files (`run_worker_first`).
 */

/** What the deploy gives the holding page's dev copy. */
export interface HoldingEnv {
  readonly ASSETS: Fetcher;
}

export default {
  fetch: (request, env) => env.ASSETS.fetch(request),
} satisfies ExportedHandler<HoldingEnv>;
