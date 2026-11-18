import { IDBFactory } from 'fake-indexeddb';
import type { LifecycleDriver } from '../contract/index';
import type { WebHost } from '../src/web';

/**
 * A browser stood in for the unit tests (#124): fake-indexeddb for
 * IndexedDB and plain EventTargets for the document and window, so the tests
 * reach no real service. The driver plays the browser's part. A real browser
 * runs the same code through the game's journeys (#146 AC5).
 */
export interface StandIn {
  readonly host: WebHost;
  readonly driver: LifecycleDriver;
  /** Every `navigator.share` call, in order. */
  readonly shared: ShareData[];
}

export interface StandInOptions {
  /** IndexedDB to share with another stand-in, as one browser would. */
  readonly indexedDB?: IDBFactory;
  /** `navigator.share`: omitted means the browser has none. */
  readonly share?: (data: ShareData) => Promise<void>;
}

/** A document that is visible until the driver says otherwise. */
class StoodInDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

export function standIn(options: StandInOptions = {}): StandIn {
  const shared: ShareData[] = [];
  const document = new StoodInDocument();
  const window = new EventTarget();
  const setVisibility = (state: DocumentVisibilityState): void => {
    document.visibilityState = state;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const share = options.share;
  return {
    host: {
      indexedDB: options.indexedDB ?? new IDBFactory(),
      document,
      window,
      navigator:
        share === undefined
          ? {}
          : {
              share: (data: ShareData) => {
                shared.push(data);
                return share(data);
              },
            },
    },
    driver: {
      hide: () => {
        setVisibility('hidden');
      },
      show: () => {
        setVisibility('visible');
      },
      pageHide: () => {
        window.dispatchEvent(new Event('pagehide'));
      },
    },
    shared,
  };
}
