import { DOOR_SECRET_HEADER } from '../../door/worker/door';

/**
 * The dev sync Worker requires its door (#784 AC4, #1078 AC3): a request
 * without the door secret is refused before anything else
 * (apps/door/worker/origin.ts, proven in apps/door/test/door-in-front.test.ts).
 * The door adds the secret to every request it passes on, so a test sending
 * it stands in for the door.
 */
const DOOR_SECRET = 'test-only-door-secret';

/** The secrets the deploy gives the Worker, as test-only values. */
export const SECRETS = {
  // The key request counts are hashed under (#164 AC2), as the deploy sets it.
  RATE_KEY: 'harness-rate-key',
  DOOR_SECRET,
} as const;

/** A request's options as the tests write them: a string body, plain headers. */
interface Init {
  readonly method?: string;
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** `init` as the door sends it on: the same request, with the door secret. */
export const throughDoor = (init: Init = {}) => ({
  ...init,
  headers: { [DOOR_SECRET_HEADER]: DOOR_SECRET, ...init.headers },
});
