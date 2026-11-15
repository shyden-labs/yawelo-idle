/**
 * The blob of one chosen save, as hex, and whether it reads back (#159
 * AC5). tests/engines/save-blob.spec.ts runs this in Node and, bundled as a
 * shipped build would bundle it, in each browser engine, and compares.
 */
import { loadBlob, save, toBlob } from '../src/index.ts';
import { CONTENT_VERSION, played } from './states.ts';

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The played game's blob, as lowercase hex. */
export function blobHex(): string {
  return hex(toBlob(save(played(), {}, CONTENT_VERSION)));
}

/** Whether the played game's blob reads back to the save it was written from. */
export function readsBack(): boolean {
  const saved = save(played(), {}, CONTENT_VERSION);
  const result = loadBlob(toBlob(saved));
  return result.ok && JSON.stringify(result.save) === JSON.stringify(saved);
}
