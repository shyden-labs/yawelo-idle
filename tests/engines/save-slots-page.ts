/**
 * The save slots over the browser's real storage (#160 AC6), for
 * tests/engines/save-slots.spec.ts, which bundles this as a shipped build
 * would and runs it in each engine. The storage is the web platform's own,
 * built from the page's globals as the game's shell builds it.
 */
import { createWebPlatform } from '../../packages/platform/src/index';
import { save, saveSlots, type SlotsRead } from '../../packages/save/src/index';
import { newGame } from '../../packages/save/test/states';

const storage = () => createWebPlatform(globalThis).storage;

const summary = (read: SlotsRead) =>
  read.kind === 'loaded'
    ? { kind: read.kind, build: read.save.contentVersion, back: read.back }
    : read;

/** Writes builds `from` to `to`, one save each, and reports the slots. */
export async function writeBuilds(from: number, to: number) {
  const slots = saveSlots(storage());
  const written: boolean[] = [];
  for (let n = from; n <= to; n += 1) {
    const result = await slots.write(save(newGame(), {}, `build-${String(n)}`));
    written.push(result.written);
  }
  return { written, ...(await readSlots()) };
}

/** The slot keys held and what reading them finds. */
export async function readSlots() {
  const keys = (await storage().keys()).filter((k) => k.startsWith('save/'));
  return { keys, read: summary(await saveSlots(storage()).read()) };
}

/** Flips the last byte of the newest slot, as a damaged disk would. */
export async function spoilLatest() {
  const store = storage();
  const keys = (await store.keys()).filter((k) => k.startsWith('save/'));
  const key = keys.at(-1) ?? '';
  const bytes = Uint8Array.from((await store.get(key)) ?? []);
  bytes[bytes.byteLength - 1] = (bytes[bytes.byteLength - 1] ?? 0) ^ 0xff;
  await store.set(key, bytes);
  return key;
}
