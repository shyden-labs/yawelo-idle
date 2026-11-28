/**
 * The webhook's body reader (#1107): a body is read one chunk at a time into
 * a buffer of `MAX_HOOK_BYTES`, and the chunk that passes it cancels the
 * stream, so a body with no declared length is never read whole (as
 * apps/door/worker/dev-pass/form.ts reads a form).
 */

/** GitHub's issue payloads are tens of kilobytes; nothing it sends nears this. */
export const MAX_HOOK_BYTES = 1_048_576;

/** The stream's bytes, or 413 with the stream cancelled as soon as they pass `MAX_HOOK_BYTES`. */
export async function readUpToCap(
  stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer | 413> {
  const bytes = new Uint8Array(MAX_HOOK_BYTES);
  let length = 0;
  // `for await` reads one chunk at a time, so nothing is pulled past the chunk
  // that passes the cap, and leaving the loop early cancels the stream (the
  // stream's async iterator; SonarCloud S9382 allows `for await`).
  for await (const chunk of stream) {
    if (length + chunk.byteLength > MAX_HOOK_BYTES) return 413;
    bytes.set(chunk, length);
    length += chunk.byteLength;
  }
  return bytes.slice(0, length).buffer;
}

/**
 * Whether a declared length passes `MAX_HOOK_BYTES`, so the body is refused
 * before any of it is read. A length that is not a number never reaches the
 * Worker: the server answers 400 (apps/site/test/roadmap/routes.test.ts).
 */
export function declaredOverCap(headers: Headers): boolean {
  return Number(headers.get('Content-Length')) > MAX_HOOK_BYTES;
}
