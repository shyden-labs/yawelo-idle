import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MEANT_FOR } from '../github-fake/contract';

/**
 * Serves a fake GitHub handler (test/github-fake/fake-github.ts) on a loopback
 * port for the roadmap tests (#341). The test Worker forwards each
 * api.github.com request here with the address it was meant for in
 * `MEANT_FOR`; the handler sees that address again, as it would have under
 * Miniflare's outbound service, so it judges exactly what GitHub would.
 */
export async function serveFake(
  handler: (request: Request) => Promise<Response>,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.on('end', () => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers))
        if (typeof value === 'string' && name !== MEANT_FOR && name !== 'host')
          headers.set(name, value);
      const meant = incoming.headers[MEANT_FOR];
      const method = incoming.method ?? 'GET';
      const request = new Request(
        typeof meant === 'string'
          ? meant
          : `http://not-forwarded${incoming.url ?? '/'}`,
        {
          method,
          headers,
          body:
            method === 'GET' || method === 'HEAD'
              ? null
              : Buffer.concat(chunks),
        },
      );
      void handler(request).then(async (response) => {
        outgoing.writeHead(
          response.status,
          Object.fromEntries(response.headers),
        );
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
