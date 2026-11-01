/**
 * The dev hostname adapter's one Function (#429), on every path (`[[path]]`
 * matches the root too). It forwards each request, unchanged, to the Worker
 * its host names in ../hosts.ts: the site Worker (`SITE`), whose gate, game
 * binding and pages stay as they are, the sync Worker (`SYNC`), or the
 * holding page's dev copy (`HOLDING`, #768). Any other host answers 404.
 * `forward` holds the logic, unit-tested in tests/unit/dev-hosts.test.ts;
 * the deployed adapter in front of the real Workers is checked after every
 * dev deploy by scripts/verify-dev-hosts.ts (#816).
 */
import { forward } from '../hosts';

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  forward(request, env);
