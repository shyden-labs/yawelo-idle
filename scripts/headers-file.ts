/**
 * Reads a Cloudflare `_headers` file the way Workers static assets read it: a
 * path line, then indented `Name: value` lines, `#` comments ignored (#621).
 * One home for the holding page's headers: prod-config.test.ts pins them, and
 * verify-prod.ts checks production serves exactly them. Header names are
 * lower-cased, as `Headers` reports them.
 */
export type HeaderRules = Map<string, Map<string, string>>;

export function headerRules(text: string): HeaderRules {
  const rules: HeaderRules = new Map();
  let current: Map<string, string> | undefined;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = new Map();
      rules.set(line.trim(), current);
      continue;
    }
    if (current === undefined)
      throw new Error(`header before any path: ${line}`);
    const colon = line.indexOf(':');
    if (colon < 0) throw new Error(`not a header line: ${line}`);
    current.set(
      line.slice(0, colon).trim().toLowerCase(),
      line.slice(colon + 1).trim(),
    );
  }
  return rules;
}

/** The headers a rule path sets, or a thrown error naming the path. */
export function ruleFor(rules: HeaderRules, path: string): Map<string, string> {
  const rule = rules.get(path);
  if (rule === undefined) throw new Error(`_headers has no ${path} rule`);
  return rule;
}
