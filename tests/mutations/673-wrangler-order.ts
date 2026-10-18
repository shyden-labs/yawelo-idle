import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * deploy-dev deploys the holding page's dev copy before the site Worker that
 * binds it (#673), and the config table in tests/unit/wrangler-steps.ts
 * names the calls in workflow order. Predicted before the first run: the
 * table put back in the old order no longer matches the dry runs' order,
 * read from the workflow. Integration-suite mutation: it runs in CI.
 */

const STEPS = 'tests/integration/wrangler-steps.test.ts';
const READS = `${STEPS} › every wrangler call reads the config it means (#627) >`;

export default mutationFile({
  targets: [STEPS],
  mutations: [
    {
      name: 'site-before-holding',
      file: 'tests/unit/wrangler-steps.ts',
      anchor:
        "  {\n    step: \"deploy-dev.yml / deploy / Deploy the holding page's dev copy\",\n    config: 'apps/site/holding-dev/wrangler.jsonc',\n  },\n  {\n    step: 'deploy-dev.yml / deploy / Deploy the site Worker with its secrets',\n    config: 'apps/site/wrangler.jsonc',\n  },\n",
      replacement:
        "  {\n    step: 'deploy-dev.yml / deploy / Deploy the site Worker with its secrets',\n    config: 'apps/site/wrangler.jsonc',\n  },\n  {\n    step: \"deploy-dev.yml / deploy / Deploy the holding page's dev copy\",\n    config: 'apps/site/holding-dev/wrangler.jsonc',\n  },\n",
      red: {
        [`${READS} dry-runs every deploy of a tracked config`]:
          "Deploy the holding page's dev copy",
      },
    },
  ],
});
