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
  const reader = stream.getReader();
  const bytes = new Uint8Array(MAX_HOOK_BYTES);
  let length = 0;
  // One read at a time, so nothing is pulled past the chunk that passes the cap.
  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    if (length + chunk.value.byteLength > MAX_HOOK_BYTES) {
      await reader.cancel();
      return 413;
    }
    bytes.set(chunk.value, length);
    length += chunk.value.byteLength;
  }
  return bytes.slice(0, length).buffer;
}
