/**
 * @yawelo-idle/save: a player's save, its version and the migration chain
 * (#158; spec §6.5, §12.1; DN18, DN20).
 *
 * A save is plain JSON: the core state, the player's settings and the head
 * of the event log, stamped with `saveVersion` (the shape of this file) and
 * `contentVersion` (the content build the state was played against). Every
 * shape this package has ever written stays readable: each version but the
 * current one has a migration to the next, run in order on load, and each
 * has a golden fixture its test loads. A save from a newer app is refused
 * with a typed reason and must never be written over.
 *
 * A stored save is a blob (#159): the canonical bytes, compressed, behind a
 * SHA-256 of them; `loadBlob` reads one and refuses a damaged one by a typed
 * reason. The latest save and 5 rotating backups (#160) are slots of blobs:
 * `saveSlots` writes each save to a new slot and reads back the newest one
 * that loads.
 */
export {
  canonicalBytes,
  loadBlob,
  toBlob,
  type CorruptReason,
} from './blob.ts';
export {
  BACKUPS,
  saveSlots,
  type SaveSlots,
  type SlotStorage,
  type SlotsRead,
  type SlotWrite,
} from './slots.ts';
export {
  load,
  mayReplace,
  save,
  type LoadRefusal,
  type LoadResult,
  type ReplaceCheck,
} from './save.ts';
export {
  checkChain,
  CHAIN,
  MIGRATIONS,
  SAVE_VERSION,
  type Chain,
  type Migration,
} from './migrations.ts';
export {
  saveSchema,
  type LogHead,
  type Save,
  type Settings,
} from './schema.ts';
