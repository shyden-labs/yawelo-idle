import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The schedule watch (#710), predicted before the first run. Each row puts
 * back one way it could pass while a daily workflow has stopped: a limit
 * read loosely or an offset dropped, a disabled workflow, a failed or a
 * still-running run judged wrong, an old run read for the newest, a failed
 * read passed over, the push trigger that does not hang on any schedule
 * dropped (AC3), and the watched list or the facts read drifting from what
 * is there.
 *
 * The rows on `scripts/issue-report.ts` moved here from
 * 687-owner-review.ts when the report got its own home: each now turns
 * both daily checks' tests red, and predicts both.
 */

const WATCH = 'tests/unit/schedule-watch.test.ts';
const WORKFLOW = 'tests/unit/schedule-watch-workflow.test.ts';
const OWNER = 'tests/unit/owner-review.test.ts';
const JUDGE = `${WATCH} › workflowJudgement >`;
const RUN = `${WATCH} › scheduleWatch >`;
const LIST = `${WATCH} › WATCHED >`;
const YML = `${WORKFLOW} › schedule-watch.yml (#710) >`;
const OWNER_REPORT = `${OWNER} › ownerReview >`;
const SCRIPT = 'scripts/schedule-watch.ts';
const REPORTER = 'scripts/issue-report.ts';
const FILE = '.github/workflows/schedule-watch.yml';

export default mutationFile({
  targets: [WATCH, WORKFLOW, OWNER],
  mutations: [
    {
      name: 'limit-inclusive',
      file: SCRIPT,
      anchor: '  if (now - at > LIMIT_HOURS * HOUR)\n',
      replacement: '  if (now - at >= LIMIT_HOURS * HOUR)\n',
      red: {
        [`${JUDGE} passes a run exactly at the limit`]: 'to deeply equal',
      },
    },
    {
      name: 'first-seen-never-late',
      file: SCRIPT,
      anchor: '    if (now - seen > LIMIT_HOURS * HOUR)\n',
      replacement: '    if (false)\n',
      red: {
        [`${JUDGE} reads a time with an offset, as GitHub writes a workflow's times`]:
          'to deeply equal',
      },
    },
    {
      name: 'offset-dropped',
      file: SCRIPT,
      anchor: '  const at = Date.parse(value);\n',
      replacement: "  const at = Date.parse(value.slice(0, 19) + 'Z');\n",
      red: {
        [`${JUDGE} reads a time with an offset, as GitHub writes a workflow's times`]:
          'to deeply equal',
      },
    },
    {
      name: 'state-unjudged',
      file: SCRIPT,
      anchor: "  if (workflow.state !== 'active')\n",
      replacement: '  if (false)\n',
      red: {
        [`${JUDGE} names a disabled workflow, and where to enable it`]:
          'to deeply equal',
      },
    },
    {
      name: 'conclusion-unjudged',
      file: SCRIPT,
      anchor:
        "  if (newest.status === 'completed' && newest.conclusion !== 'success')\n",
      replacement: '  if (false)\n',
      red: {
        [`${JUDGE} names a newest scheduled run that failed, with its address`]:
          'to deeply equal',
        [`${JUDGE} names a newest scheduled run that was cancelled`]:
          'to deeply equal',
      },
    },
    {
      name: 'running-read-as-failed',
      file: SCRIPT,
      anchor: "newest.status === 'completed' && newest.conclusion",
      replacement: 'newest.conclusion',
      red: {
        [`${JUDGE} passes a newest scheduled run still in progress`]:
          'to deeply equal',
      },
    },
    {
      name: 'oldest-run-judged',
      file: SCRIPT,
      anchor: 'runs.workflow_runs[0]',
      replacement: 'runs.workflow_runs.at(-1)',
      red: {
        [`${JUDGE} judges only the newest run, the first GitHub lists`]:
          'to deeply equal',
      },
    },
    {
      name: 'not-json-passed',
      file: SCRIPT,
      anchor:
        "      problems: [`could not read ${file}'s state: the reply is not JSON`],\n",
      replacement: '      problems: [],\n',
      red: {
        [`${JUDGE} fails closed on a workflow reply that is not JSON`]:
          'to deeply equal',
      },
    },
    {
      name: 'read-failure-passed',
      file: SCRIPT,
      anchor:
        '      problems = [`could not read ${file} on GitHub: ${message(error)}`];\n',
      replacement: '      problems = [];\n',
      red: {
        [`${RUN} reports a read that fails, never passing over it`]: 'to be',
      },
    },
    {
      name: 'facts-population-lost',
      file: SCRIPT,
      anchor: "  const checked = ['state'];\n",
      replacement: '  const checked: string[] = [];\n',
      red: {
        [`${JUDGE} finds nothing when the newest scheduled run passed within the limit`]:
          'schedule-watch/facts-checked',
        [`${JUDGE} passes a run exactly at the limit`]:
          'schedule-watch/at-limit-checked',
        [`${JUDGE} passes a newest scheduled run still in progress`]:
          'schedule-watch/running-checked',
        [`${JUDGE} judges only the newest run, the first GitHub lists`]:
          'schedule-watch/newest-only-checked',
        [`${JUDGE} passes a workflow with no scheduled run yet that GitHub first saw within the limit`]:
          'schedule-watch/never-run-checked',
      },
    },
    {
      name: 'facts-population-grown',
      file: SCRIPT,
      anchor: "  checked.push('newest scheduled run');\n",
      replacement: "  checked.push('newest scheduled run', 'twice');\n",
      red: {
        [`${JUDGE} finds nothing when the newest scheduled run passed within the limit`]:
          'schedule-watch/facts-checked',
        [`${JUDGE} passes a run exactly at the limit`]:
          'schedule-watch/at-limit-checked',
        [`${JUDGE} passes a newest scheduled run still in progress`]:
          'schedule-watch/running-checked',
        [`${JUDGE} judges only the newest run, the first GitHub lists`]:
          'schedule-watch/newest-only-checked',
      },
    },
    {
      name: 'push-trigger-dropped',
      file: FILE,
      anchor: '  push:\n    branches: [develop]\n',
      replacement: '',
      red: {
        [`${YML} runs on every push to develop, once a day, and by hand`]:
          'to deeply equal',
      },
    },
    {
      name: 'watch-cron-drifts',
      file: FILE,
      anchor: "    - cron: '47 14 * * *'\n",
      replacement: "    - cron: '47 15 * * *'\n",
      red: {
        [`${LIST} names every scheduled workflow on disk with its cron, and nothing else`]:
          'to deeply equal',
        [`${YML} runs on every push to develop, once a day, and by hand`]:
          'to deeply equal',
      },
    },
    {
      name: 'search-failure-unsaid',
      file: REPORTER,
      anchor:
        '    notes.push(\n      `could not search the open issues for an earlier report: ${message(error)}`,\n    );\n',
      replacement: '    void error;\n',
      red: {
        [`${OWNER_REPORT} still opens an issue when the open issues cannot be searched, saying so`]:
          'to contain',
      },
    },
    {
      name: 'any-title-reused',
      file: REPORTER,
      anchor: 'item.title === title && ',
      replacement: 'true && ',
      red: {
        [`${OWNER_REPORT} comments on the issue already open rather than opening another`]:
          'to deeply equal',
        [`${RUN} comments on the issue already open for that workflow`]:
          'to deeply equal',
      },
    },
    {
      name: 'pull-request-reused',
      file: REPORTER,
      anchor: ' && item.pull_request === undefined,',
      replacement: ',',
      red: {
        [`${OWNER_REPORT} never reuses a pull request that carries the title`]:
          'to deeply equal',
      },
    },
    {
      name: 'always-a-new-issue',
      file: REPORTER,
      anchor: '  if (open === undefined) {\n',
      replacement: '  if (true) {\n',
      red: {
        [`${OWNER_REPORT} comments on the issue already open rather than opening another`]:
          'to deeply equal',
        [`${RUN} comments on the issue already open for that workflow`]:
          'to deeply equal',
      },
    },
    {
      name: 'not-assigned',
      file: REPORTER,
      anchor: "      '-f',\n      `assignees[]=${ASSIGNEE}`,\n",
      replacement: '',
      red: {
        [`${OWNER_REPORT} opens one issue assigned to Shyden when the setting is off and none is open`]:
          'to include',
        [`${RUN} opens one issue assigned to Shyden, titled for the late workflow alone`]:
          'to include',
      },
    },
  ],
});
