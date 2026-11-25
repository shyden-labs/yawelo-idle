// SCRATCH PROBE for #1107: never merged. Measures why the over-1-MiB webhook
// test sometimes reads ECONNRESET instead of 413. It fails on purpose so the
// measurement prints in CI's failure output.
import { connect } from 'node:net';
import { afterAll, expect, it } from 'vitest';
import { roadmapWorld, type RoadmapWorld } from './harness';

const HOST_NAME = 'yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev';
const SIZE = 1_048_577;
let world: RoadmapWorld | undefined;

afterAll(async () => {
  await world?.stop();
});

type Event = { t: number; what: string };

/** Raw HTTP/1.1: headers declaring SIZE bytes, then `bodyBytes` of body. */
function rawPost(
  port: number,
  bodyBytes: number,
  waitMs: number,
): Promise<Event[]> {
  return new Promise((resolve) => {
    const start = performance.now();
    const events: Event[] = [];
    const log = (what: string) =>
      events.push({ t: Math.round(performance.now() - start), what });
    const socket = connect(port, '127.0.0.1', () => {
      log('connected');
      socket.write(
        `POST /hooks/github HTTP/1.1\r\nHost: ${HOST_NAME}\r\n` +
          `Content-Length: ${String(SIZE)}\r\nX-GitHub-Event: issues\r\n` +
          `X-Hub-Signature-256: sha256=${'0'.repeat(64)}\r\n\r\n`,
      );
      log('headers written');
      if (bodyBytes > 0) {
        const ok = socket.write('x'.repeat(bodyBytes), (error) =>
          log(`body write callback: ${error ? error.message : 'ok'}`),
        );
        log(`body write returned ${String(ok)}`);
      }
    });
    socket.on('data', (chunk: Buffer) =>
      log(`data: ${chunk.toString('latin1').split('\r\n')[0] ?? ''}`),
    );
    socket.on('end', () => log('end (peer FIN)'));
    socket.on('close', (hadError) => log(`close hadError=${String(hadError)}`));
    socket.on('error', (error: NodeJS.ErrnoException) =>
      log(`error ${error.code ?? error.message}`),
    );
    setTimeout(() => {
      log('probe done');
      socket.destroy();
      resolve(events);
    }, waitMs);
  });
}

it('#1107 probe: what the server does on an early 413', async () => {
  world = roadmapWorld();
  await world.start();
  const { url } = await world.server.listen();
  const port = Number(url.port);

  const headersOnly = await rawPost(port, 0, 3000);
  const fullBody = await rawPost(port, SIZE, 3000);

  // one scenario: repeat the real test's request to measure its reset rate
  const outcomes: Record<string, number> = {};
  for (let i = 0; i < 200; i += 1) {
    let key: string;
    try {
      const response = await world.server.fetch(
        `https://${HOST_NAME}/hooks/github`,
        {
          method: 'POST',
          body: 'x'.repeat(SIZE),
          headers: {
            'X-GitHub-Event': 'issues',
            'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}`,
          },
        },
      );
      key = `status ${String(response.status)}`;
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause;
      key = `threw ${cause?.code ?? String(error)}`;
    }
    outcomes[key] = (outcomes[key] ?? 0) + 1;
  }

  expect.fail(
    `PROBE-1107 ${JSON.stringify({ url: url.href, headersOnly, fullBody, outcomes })}`,
  );
}, 120_000);
