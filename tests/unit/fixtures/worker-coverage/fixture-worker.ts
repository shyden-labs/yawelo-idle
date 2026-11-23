// The Worker tests/unit/worker-coverage.test.ts instruments (#1093). Its
// bundle and map beside it come from esbuild, as wrangler's dry run makes them:
// npx esbuild tests/unit/fixtures/worker-coverage/fixture-worker.ts --bundle
//   --format=esm --sourcemap --outfile=tests/unit/fixtures/worker-coverage/bundle.js
export class Counter {
  hello(): string {
    return 'hi';
  }
}

export default {
  fetch(request: Request): Response {
    if (new URL(request.url).pathname === '/a') {
      return new Response('a');
    }
    return new Response('other');
  },
  scheduled(): string {
    return 'ran';
  },
};
