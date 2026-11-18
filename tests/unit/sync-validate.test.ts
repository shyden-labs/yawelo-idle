import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readBody, readQuery } from '../../apps/sync-worker/src/validate';

/**
 * The input checks every sync endpoint shares (#164 AC1, AC4; spec §12.9).
 */
const MAX = 32;

const schema = z.strictObject({
  name: z.string(),
  settings: z.strictObject({ volume: z.number() }).optional(),
});

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://sync.test/v1/thing', { method: 'POST', body, headers });

/** A request whose body arrives as a stream, so it carries no Content-Length. */
const streamed = (text: string) =>
  new Request('https://sync.test/v1/thing', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    duplex: 'half',
  });

/** A JSON body exactly `length` bytes long: {"name":"aaa…"}. */
const bodyOf = (length: number) => {
  const shell = '{"name":""}';
  return `{"name":"${'a'.repeat(length - shell.length)}"}`;
};

const refusal = async (checked: Awaited<ReturnType<typeof readBody>>) => {
  if (checked.ok) throw new Error('expected a refusal');
  return {
    status: checked.response.status,
    body: await checked.response.json(),
    cache: checked.response.headers.get('cache-control'),
  };
};

describe('readBody (#164 AC1, AC4)', () => {
  it('gives back a body that matches its schema', async () => {
    expect(await readBody(post('{"name":"Ayu"}'), schema, MAX)).toEqual({
      ok: true,
      data: { name: 'Ayu' },
    });
  });

  it('accepts a body of exactly the limit', async () => {
    const body = bodyOf(MAX);
    expect(new TextEncoder().encode(body).length).toBe(MAX);
    expect((await readBody(post(body), schema, MAX)).ok).toBe(true);
  });

  it('refuses a Content-Length one over the limit with 413, without reading the body', async () => {
    const request = post(bodyOf(MAX + 1), {
      'content-length': String(MAX + 1),
    });
    expect(await refusal(await readBody(request, schema, MAX))).toEqual({
      status: 413,
      body: { error: 'too_large' },
      cache: 'no-store',
    });
    expect(request.bodyUsed).toBe(false);
  });

  it('refuses a streamed body one byte over the limit with 413', async () => {
    expect(
      (await refusal(await readBody(streamed(bodyOf(MAX + 1)), schema, MAX)))
        .status,
    ).toBe(413);
  });

  it('accepts a streamed body of exactly the limit', async () => {
    expect((await readBody(streamed(bodyOf(MAX)), schema, MAX)).ok).toBe(true);
  });

  it('refuses a body that is not JSON with 400', async () => {
    expect(
      await refusal(await readBody(post('{not json'), schema, MAX)),
    ).toEqual({
      status: 400,
      body: { error: 'invalid_body' },
      cache: 'no-store',
    });
  });

  it('refuses an unknown key with 422, naming only that key', async () => {
    expect(
      await refusal(
        await readBody(post('{"name":"Ayu","email":"x"}'), schema, MAX),
      ),
    ).toEqual({
      status: 422,
      body: { error: 'invalid_field', field: 'email' },
      cache: 'no-store',
    });
  });

  it('refuses a missing field with 422, naming it', async () => {
    expect(
      (await refusal(await readBody(post('{}'), schema, MAX))).body,
    ).toEqual({ error: 'invalid_field', field: 'name' });
  });

  it('names a nested field by its dotted path', async () => {
    expect(
      (
        await refusal(
          await readBody(
            post('{"name":"A","settings":{"volume":"x"}}'),
            schema,
            MAX * 2,
          ),
        )
      ).body,
    ).toEqual({ error: 'invalid_field', field: 'settings.volume' });
  });

  it('never echoes the value it refused', async () => {
    const { body } = await refusal(
      await readBody(post('{"name":"A","secret":"hunter2"}'), schema, MAX),
    );
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});

describe('readQuery (#164 AC1)', () => {
  const none = z.strictObject({});
  const paged = z.strictObject({ page: z.string().regex(/^\d+$/) });

  it('gives back an empty query for a route that takes none', () => {
    expect(readQuery(new URL('https://sync.test/health'), none)).toEqual({
      ok: true,
      data: {},
    });
  });

  it('gives back a query that matches its schema', () => {
    expect(readQuery(new URL('https://sync.test/x?page=2'), paged)).toEqual({
      ok: true,
      data: { page: '2' },
    });
  });

  it('refuses an unknown parameter with 422, naming it', async () => {
    const checked = readQuery(
      new URL('https://sync.test/health?debug=1'),
      none,
    );
    expect(await refusal(checked)).toEqual({
      status: 422,
      body: { error: 'invalid_field', field: 'debug' },
      cache: 'no-store',
    });
  });

  it('refuses a parameter that does not match with 422, naming it', async () => {
    const checked = readQuery(new URL('https://sync.test/x?page=two'), paged);
    expect((await refusal(checked)).body).toEqual({
      error: 'invalid_field',
      field: 'page',
    });
  });
});
