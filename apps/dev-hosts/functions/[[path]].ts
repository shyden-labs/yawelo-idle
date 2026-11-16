/**
 * The dev hostname adapter's one Function (#429), on every path (`[[path]]`
 * matches the root too). Each dev hostname stands in for its front door
 * (#784): the request goes on through the door's own code to its Worker's
 * workers.dev address in the non-PROD account, with the dev door secret.
 * Any other host answers 404. `forward` (../hosts.ts) holds the logic,
 * unit-tested in tests/unit/dev-hosts.test.ts; the deployed adapter in front
 * of the real Workers is checked after every dev deploy by
 * scripts/verify-dev-hosts.ts (#816).
 */
import { forward, type DevHostsEnv } from '../hosts';

export const onRequest: PagesFunction<DevHostsEnv> = ({ request, env }) =>
  forward(request, env, (forwarded) => fetch(forwarded));
