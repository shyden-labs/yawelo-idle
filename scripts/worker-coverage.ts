/**
 * Coverage for the Workers wrangler's test harness runs (#1093).
 *
 * workerd's inspector refuses V8 precise coverage ("Profiler is not
 * enabled", measured on #1093), so a Worker is counted by istanbul instead:
 * its dry-run bundle is instrumented with the bundle's own source map, its
 * default export is served through an entrypoint that adds `coverage()`, and
 * the harness reads that over RPC. The counts are mapped back to the source
 * files and written as lcov, one report per bundle, never joined with the
 * Vitest suites' maps of the same files (#733).
 */
import { isAbsolute, relative, sep } from 'node:path';
import libCoverage, { type CoverageMapData } from 'istanbul-lib-coverage';
import { createInstrumenter } from 'istanbul-lib-instrument';
import libReport from 'istanbul-lib-report';
import { createSourceMapStore } from 'istanbul-lib-source-maps';
import reports from 'istanbul-reports';

/** The handlers a Worker's default export may have, forwarded when present. */
const HANDLERS = ['fetch', 'scheduled', 'queue', 'email', 'tail'] as const;

/** One `export { … }` list, its items read one by one. */
const EXPORT_LIST = /export\s*\{([^}]*)\}\s*;?/g;
const DEFAULT_ITEM = /^([\w$]+)\s+as\s+default$/;

type DefaultList = { list: string; local: string; rest: string[] };

/** Every `export { … }` list that names a default export. */
function defaultLists(code: string): DefaultList[] {
  const found: DefaultList[] = [];
  for (const match of code.matchAll(EXPORT_LIST)) {
    const items = (match[1] ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const local = items
      .map((item) => DEFAULT_ITEM.exec(item)?.[1])
      .find((name) => name !== undefined);
    if (local !== undefined) {
      found.push({
        list: match[0],
        local,
        rest: items.filter((item) => !DEFAULT_ITEM.test(item)),
      });
    }
  }
  return found;
}

/**
 * Instruments a Worker bundle and serves its default export through an
 * entrypoint that forwards every handler the bundle has and adds
 * `coverage()`, the JSON of every count this isolate holds. `map` is the
 * bundle's source map; `bundlePath` names the bundle in the counts.
 */
export function instrumentWorker(
  code: string,
  map: object | undefined,
  bundlePath: string,
): string {
  const defaults = defaultLists(code);
  const [only] = defaults;
  if (defaults.length !== 1 || only === undefined) {
    throw new Error(
      `expected one default export in ${bundlePath}, found ${String(defaults.length)}`,
    );
  }
  const withoutDefault = code.replace(
    only.list,
    only.rest.length > 0 ? `export { ${only.rest.join(', ')} };` : '',
  );

  const instrumenter = createInstrumenter({
    esModules: true,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
  });
  const instrumented = instrumenter.instrumentSync(
    withoutDefault,
    bundlePath,
    map as Parameters<typeof instrumenter.instrumentSync>[2],
  );

  const forwarded = HANDLERS.map(
    (name) =>
      `  ${name}(event) { return ${only.local}.${name}(event, this.env, this.ctx); }`,
  ).join('\n');
  return `${instrumented}
import { WorkerEntrypoint as __yaweloEntrypoint } from 'cloudflare:workers';
class __YaweloCovered extends __yaweloEntrypoint {
${forwarded}
  coverage() { return JSON.stringify(globalThis.__coverage__ ?? {}); }
}
for (const name of ${JSON.stringify(HANDLERS)}) {
  if (typeof ${only.local}[name] !== 'function') delete __YaweloCovered.prototype[name];
}
export default __YaweloCovered;
`;
}

/** A source file under the repo and outside node_modules, named from the root. */
function inRepo(file: string, repoRoot: string): string | undefined {
  const named = relative(repoRoot, file);
  if (named.startsWith('..') || isAbsolute(named)) return undefined;
  if (named.split(sep).includes('node_modules')) return undefined;
  return named.split(sep).join('/');
}

/** Runs istanbul's lcov report over a map, collecting its text. */
function lcovText(map: libCoverage.CoverageMap, repoRoot: string): string {
  let lcov = '';
  const context = libReport.createContext({ coverageMap: map, dir: repoRoot });
  // The context keeps one writer; its files are taken here, so nothing is
  // written to disk.
  context.getWriter().writeFile = () =>
    ({
      write: (text: string) => {
        lcov += text;
      },
      println: (text: string) => {
        lcov += `${text}\n`;
      },
      close: () => undefined,
    }) as never;
  reports.create('lcovonly').execute(context);
  return lcov;
}

/**
 * The lcov of one bundle's counts (any number of runs, added up), mapped back
 * to the source files under `repoRoot`. Files outside it, and under
 * node_modules, are left out.
 */
export async function lcovFrom(
  maps: readonly CoverageMapData[],
  repoRoot: string,
): Promise<string> {
  const joined = libCoverage.createCoverageMap({});
  for (const data of maps) joined.merge(data);
  const mapped = await createSourceMapStore().transformCoverage(joined);

  const kept = libCoverage.createCoverageMap({});
  for (const file of mapped.files()) {
    const named = inRepo(file, repoRoot);
    if (named !== undefined) {
      kept.addFileCoverage({
        ...mapped.fileCoverageFor(file).data,
        path: named,
      });
    }
  }
  return kept.files().length === 0 ? '' : lcovText(kept, repoRoot);
}
