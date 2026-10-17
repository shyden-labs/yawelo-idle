import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The web smoke suite (#649, spec §8 AC3): Playwright, after the game's
 * build, in Chromium, Firefox and WebKit. Predicted before the first run.
 * Each red test is named once per project. `shell-logs-an-error` changes the
 * game's entry, which the suite sees only in the built bundle.
 */

const SHELL = 'tests/web/shell.spec.ts';
const PROJECTS = ['chromium', 'firefox', 'webkit'] as const;

/** One test's name in each project, all predicted to fail with `text`. */
const inEveryProject = (title: string, text: string) =>
  Object.fromEntries(PROJECTS.map((p) => [`${SHELL} › ${p} > ${title}`, text]));

export default mutationFile({
  targets: [SHELL],
  mutations: [
    {
      name: 'shell-logs-an-error',
      file: 'apps/web/src/main.ts',
      anchor: 'export default mount(Shell, { target });',
      replacement:
        "console.error('planted by #649');\nexport default mount(Shell, { target });",
      red: inEveryProject(
        'the shell renders with no console errors or page errors',
        'planted by #649',
      ),
    },
    {
      name: 'policy-default-open',
      file: 'apps/web/worker/policy.ts',
      anchor: "default-src 'self';",
      replacement: 'default-src *;',
      red: inEveryProject(
        'the shell runs under its Content Security Policy with no violation',
        "default-src 'self'",
      ),
    },
  ],
});
