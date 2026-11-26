/**
 * What CI sends an origin in place of its door (#1078 AC3). CI reaches the dev
 * origins at their workers.dev addresses, never through a door (#784 AC1b):
 * once the doors check the DEV pass, no CI request could pass them. An origin
 * believes a door's name only alongside the door secret
 * (apps/door/worker/origin.ts `doorOf`), so CI sends both, the name read from
 * the door map, never written out.
 */

import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
} from '../apps/door/worker/doors.ts';

export function standInFor(
  worker: string,
  secret: string,
): Record<string, string> {
  const found = [...DOORS].find(([, door]) => door.worker === worker);
  if (found === undefined) throw new Error(`no door reaches ${worker}`);
  const [host, door] = found;
  if (door.environment !== 'dev')
    throw new Error(
      `${worker} sits behind a ${door.environment} door, not a dev one`,
    );
  if (secret === '') throw new Error('the door secret is empty');
  return { [DOOR_SECRET_HEADER]: secret, [DOOR_HOST_HEADER]: host };
}
