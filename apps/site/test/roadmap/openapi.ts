import { Ajv2020 } from 'ajv/dist/2020.js';
import spec from '../../api/roadmap.openapi.json' with { type: 'json' };
import privateSpec from '../../api/private.openapi.json' with { type: 'json' };

/**
 * Judges a real answer against a hand-written API spec: the public roadmap
 * API's (#588) or the private operations' (#589) (Shyden, 2026-10-15: the
 * spec is the contract, and tests fail when the API answers differently).
 * Returns every way the answer differs, so a test expects an empty list and
 * a failure names what broke.
 */

export { privateSpec, spec };

interface Media {
  schema: object;
}
interface Header {
  schema?: object;
  $ref?: string;
}
interface SpecResponse {
  $ref?: string;
  headers?: Record<string, Header>;
  content?: Record<string, Media>;
}
type Operation = { responses: Record<string, SpecResponse> };
type Paths = Record<string, Record<string, Operation>>;
/** Headers as both the DOM and miniflare give them. */
interface HeaderReader {
  get(name: string): string | null;
}

interface Spec {
  paths: object;
}

/** A judge for `document`: its own validator, so two specs never share refs. */
export function judgeFor(document: Spec) {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  // The spec document's own fields, which are not JSON Schema: refs into
  // `components` resolve through them.
  ajv.addVocabulary(['openapi', 'info', 'servers', 'paths', 'components']);
  // RFC 3339 date-times, as `Date.prototype.toISOString` writes them.
  ajv.addFormat(
    'date-time',
    (s: string) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
        s,
      ) && !Number.isNaN(Date.parse(s)),
  );
  ajv.addSchema(document, 'spec');

  /** The part of `ref` after `#/`, as a JSON pointer inside the spec. */
  const pointer = (ref: string): string => `spec${ref}`;

  function resolve<T extends { $ref?: string }>(value: T): T {
    if (value.$ref === undefined) return value;
    const path = value.$ref.replace(/^#\//, '').split('/');
    let node: unknown = document;
    // A runtime population: the steps of one pointer.
    for (const step of path) node = (node as Record<string, unknown>)[step];
    return node as T;
  }

  function check(schema: object, value: unknown, where: string): string[] {
    const ref = (schema as { $ref?: string }).$ref;
    const validate =
      ref === undefined ? ajv.compile(schema) : ajv.getSchema(pointer(ref));
    if (validate === undefined)
      return [`${where}: no schema at ${String(ref)}`];
    if (validate(value)) return [];
    return (validate.errors ?? []).map(
      (e) => `${where}${e.instancePath} ${e.message ?? 'is invalid'}`,
    );
  }

  /** What the spec says `method path` answers with `status`, or undefined. */
  function specResponse(
    path: string,
    method: string,
    status: number,
  ): SpecResponse | undefined {
    const operation = (document.paths as unknown as Paths)[path]?.[method];
    const found = operation?.responses[String(status)];
    return found === undefined ? undefined : resolve(found);
  }

  /**
   * Every difference between an answer (its status, headers and body, the
   * body already read: parsed JSON, or text) and what the spec documents.
   */
  function differences(
    path: string,
    method: string,
    answer: { status: number; headers: HeaderReader; body: unknown },
  ): string[] {
    const documented = specResponse(path, method, answer.status);
    if (documented === undefined)
      return [
        `${method.toUpperCase()} ${path} answered ${String(answer.status)}, which the spec does not document`,
      ];
    const problems: string[] = [];
    // A runtime population: the headers this response documents.
    for (const [name, header] of Object.entries(documented.headers ?? {})) {
      const value = answer.headers.get(name);
      const { schema } = resolve(header);
      if (value === null) problems.push(`header ${name} is missing`);
      else if (schema !== undefined)
        problems.push(...check(schema, value, `header ${name}`));
    }
    const content = documented.content ?? {};
    const types = Object.keys(content);
    const type = (answer.headers.get('Content-Type') ?? '').split(';')[0] ?? '';
    if (types.length === 0) {
      if (answer.body !== null && answer.body !== '')
        problems.push('the spec documents no body, but one was sent');
      return problems;
    }
    const media = content[type];
    if (media === undefined) {
      problems.push(
        `Content-Type ${type || '(none)'} is not one of ${types.join(', ')}`,
      );
      return problems;
    }
    return [...problems, ...check(media.schema, answer.body, 'body')];
  }

  /** Reads `response` and judges it, its body parsed as its type says. */
  async function judged(
    path: string,
    method: string,
    response: {
      status: number;
      headers: HeaderReader;
      text(): Promise<string>;
    },
  ): Promise<string[]> {
    const text = await response.text();
    const json = (response.headers.get('Content-Type') ?? '').startsWith(
      'application/json',
    );
    const body: unknown = text === '' ? null : json ? JSON.parse(text) : text;
    return differences(path, method, {
      status: response.status,
      headers: response.headers,
      body,
    });
  }

  return { specResponse, differences, judged };
}

const roadmapJudge = judgeFor(spec);
export const { specResponse, differences, judged } = roadmapJudge;
/** The private operations' judge (#589). */
export const privateJudge = judgeFor(privateSpec);
