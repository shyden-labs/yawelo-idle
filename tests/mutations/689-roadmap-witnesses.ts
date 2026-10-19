import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The roadmap judges each change by the webhook that named its card (#689),
 * through wrangler's harness, predicted before the first run. Each row puts
 * back one way the old time rule or a half fix went wrong: a late read not
 * counted, the witness never handed on, an archived card never seen, one
 * card's webhook excusing another's change, a late read forgetting what it
 * owed, a late webhook clearing every card, unseen webhooks not counted, and
 * drift cleared by a read no webhook explained.
 */

const ROADMAP = 'apps/site/test/roadmap/roadmap.test.ts';
const ROUTES = 'apps/site/test/roadmap/routes.test.ts';
const BEHIND = `${ROADMAP} › a read behind its webhook (#689) >`;
const DRIFT = `${ROADMAP} › drift >`;
const HANDED_ON = `${ROUTES} › /hooks/github > hands the delivery’s card and time to the roadmap, which counts a read behind it as late`;

export default mutationFile({
  targets: [ROADMAP, ROUTES],
  mutations: [
    {
      name: 'stale-read-not-counted',
      file: 'apps/site/worker/roadmap.ts',
      anchor: '        this.state.staleReads += 1;\n',
      replacement: '',
      red: {
        [`${BEHIND} counts no drift when an event’s read is behind its webhook and the check then finds the change`]:
          'expected +0 to be 1',
        [`${BEHIND} counts drift for a change no webhook named, though another card’s webhook was owed`]:
          'expected +0 to be 1',
        [`${BEHIND} counts no drift when an event’s read is behind a card added to the board`]:
          'expected +0 to be 1',
        [`${BEHIND} drops a webhook no check shows within the grace, counting it unseen`]:
          'expected +0 to be 2',
        [HANDED_ON]: 'expected +0 to be 1',
      },
    },
    {
      // eventWitness of no event name is null, as if the hook passed none,
      // and the import stays in use.
      name: 'witness-not-handed-on',
      file: 'apps/site/worker/index.ts',
      anchor:
        '  ctx.waitUntil(roadmap(env).changed(eventWitness(name, payload)));\n',
      replacement:
        "  ctx.waitUntil(roadmap(env).changed(eventWitness('', payload)));\n",
      red: { [HANDED_ON]: 'expected +0 to be 1' },
    },
    {
      name: 'gone-card-never-seen',
      file: 'apps/site/worker/witness.ts',
      anchor: '  if (read === undefined) return witness.gone;\n',
      replacement: '  if (read === undefined) return false;\n',
      red: {
        [`${BEHIND} counts no drift when an archived card leaves the board by webhook`]:
          'expected 1 to be +0',
      },
    },
    {
      name: 'any-witness-explains-every-change',
      file: 'apps/site/worker/witness.ts',
      anchor: '    unexplained: changed.filter((n) => !named.has(n)),\n',
      replacement:
        '    unexplained: named.size > 0 ? [] : changed.filter((n) => !named.has(n)),\n',
      red: {
        [`${BEHIND} counts drift for a change no webhook named, though another card’s webhook was owed`]:
          'expected +0 to be 1',
        [`${BEHIND} counts drift for a change an event’s read found that no webhook named`]:
          'expected +0 to be 1',
      },
    },
    {
      name: 'late-read-forgets-its-witness',
      file: 'apps/site/worker/witness.ts',
      anchor: '    owed.push(entry);\n',
      replacement: '',
      red: {
        [`${BEHIND} counts no drift when an event’s read is behind its webhook and the check then finds the change`]:
          'expected 1 to be +0',
        [`${BEHIND} counts drift for a change no webhook named, though another card’s webhook was owed`]:
          'expected 2 to be 1',
        [`${BEHIND} counts no drift when an event’s read is behind a card added to the board`]:
          'expected 1 to be +0',
        [`${BEHIND} drops a webhook no check shows within the grace, counting it unseen`]:
          'expected +0 to be 1',
        [`${BEHIND} lets a dropped webhook explain no later change`]:
          'expected +0 to be 1',
      },
    },
    {
      name: 'late-webhook-clears-every-card',
      file: 'apps/site/worker/roadmap.ts',
      anchor:
        '        ([card, since]) => card !== String(number) || now - since > GRACE_MS,\n',
      replacement: '        ([, since]) => now - since > GRACE_MS,\n',
      red: {
        [`${BEHIND} lets a late webhook within the grace explain its own card, not another`]:
          'expected +0 to be 1',
      },
    },
    {
      name: 'unseen-webhooks-not-counted',
      file: 'apps/site/worker/roadmap.ts',
      anchor: '      this.state.unseenEvents += counted.unseen;\n',
      replacement: '',
      red: {
        [`${BEHIND} drops a webhook no check shows within the grace, counting it unseen`]:
          'expected +0 to be 1',
        [`${BEHIND} lets a dropped webhook explain no later change`]:
          'expected +0 to be 1',
      },
    },
    {
      name: 'any-read-clears-drift',
      file: 'apps/site/worker/roadmap.ts',
      anchor: '      if (counted.explained.length > 0) this.state.drift = 0;\n',
      replacement: '      this.state.drift = 0;\n',
      red: {
        [`${DRIFT} counts drift when the webhook comes only after the grace`]:
          'expected +0 to be 1',
        [`${DRIFT} keeps drift when the next change is found by a check, not a webhook`]:
          'expected +0 to be 1',
      },
    },
  ],
});
