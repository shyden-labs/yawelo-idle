/**
 * Input checks shared by every sync endpoint (#164; spec §12.9): a body over
 * its route's size is refused before it is parsed (413), a body that is not
 * JSON is refused (400), and a body or query that does not match its route's
 * schema is refused with 422 naming the one field at fault and nothing else.
 * Schemas are strict, so an unknown key is refused by name.
 */
import type { z } from 'zod';

/** What a check gives back: the parsed value, or the refusal to send. */
export type Checked<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly response: Response };

const refuse = (
  status: number,
  body: Record<string, string>,
): Checked<never> => ({
  ok: false,
  response: Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  }),
});

/**
 * The one field a failed parse is about, as a dotted path: an unknown key's
 * own name, else the path of the first issue. Never the value.
 */
function fieldOf(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return '';
  const path = issue.path.map(String);
  if (issue.code === 'unrecognized_keys') path.push(issue.keys[0] ?? '');
  return path.join('.');
}

function parsed<T>(schema: z.ZodType<T>, value: unknown): Checked<T> {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, data: result.data }
    : refuse(422, { error: 'invalid_field', field: fieldOf(result.error) });
}

/**
 * The body's bytes, or null once more than `maxBytes` have arrived: a stream
 * carries no Content-Length, so the count is kept while reading.
 */
async function bytesUpTo(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

/** A request's JSON body, at most `maxBytes` long, parsed by `schema`. */
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number,
): Promise<Checked<T>> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return refuse(413, { error: 'too_large' });
  const bytes = await bytesUpTo(request, maxBytes);
  if (bytes === null) return refuse(413, { error: 'too_large' });
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return refuse(400, { error: 'invalid_body' });
  }
  return parsed(schema, value);
}

/** A request's query parameters, each a string, parsed by `schema`. */
export function readQuery<T>(url: URL, schema: z.ZodType<T>): Checked<T> {
  return parsed(schema, Object.fromEntries(url.searchParams));
}
