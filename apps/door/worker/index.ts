/**
 * The front door Worker (#784 AC4): every request goes through `pass`
 * (./door.ts), with the runtime's own fetch. The Env is declared by door.ts
 * rather than generated, since the config binds nothing and the three values
 * are secrets set by the deploy.
 */
import { pass, type DoorEnv } from './door';

export default {
  fetch(request, env): Promise<Response> {
    return pass(request, env, (forwarded) => fetch(forwarded));
  },
} satisfies ExportedHandler<DoorEnv>;
