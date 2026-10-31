/**
 * TEST ONLY (#506), served by wrangler.injected.jsonc and never deployed.
 *
 * The real sync Worker, run inside workerd with one change to its
 * environment that no deploy has, named by the test in the `x-inject`
 * request header:
 *
 * - `commit=<sha>`: COMMIT is `<sha>`, as `--var COMMIT:<sha>` sets it.
 *
 * Any other value is refused with 400, so a mistyped case cannot pass on the
 * unchanged environment. A failing D1 is not injected here: the real Worker
 * meets a really broken local D1 in health-broken-d1.test.ts (#817).
 */
import worker from '../src/index';

export default {
  async fetch(request, env): Promise<Response> {
    const inject = request.headers.get('x-inject') ?? '';
    if (!inject.startsWith('commit=')) {
      return new Response(`unknown x-inject: ${inject}`, { status: 400 });
    }
    return worker.fetch(request, {
      ...env,
      COMMIT: inject.slice('commit='.length),
    });
  },
} satisfies ExportedHandler<Env>;
