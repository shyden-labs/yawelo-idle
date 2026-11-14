import type { Outcome, Platform, PlatformStorage } from './platform';

/**
 * What the web platform reads from the browser, passed in so the unit tests
 * can stand each part in (#124). `webPlatform()` passes the real globals.
 */
export interface WebHost {
  readonly indexedDB: IDBFactory;
  readonly document: Pick<
    Document,
    'visibilityState' | 'addEventListener' | 'removeEventListener'
  >;
  readonly window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  readonly navigator: { readonly share?: (data: ShareData) => Promise<void> };
}

const DATABASE = 'yawelo-idle';
const STORE = 'kv';

/** Web regions 1 and 2; Steam and mobile unlock the rest (spec §6.4). */
const WEB_REGIONS: readonly number[] = Object.freeze([1, 2]);

const notDone = (reason: string): Outcome => ({ done: false, reason });
const NO_NOTIFICATIONS = notDone('the web build sends no notifications');
const NO_ACHIEVEMENTS = notDone('the web build has no achievements');
const NO_HAPTICS = notDone('the web build has no haptics');
const NO_SHARE = notDone('this browser cannot share');
const SHARE_CLOSED = notDone('the player closed the share sheet');

const settled = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
  });

/** One key-value object store, opened on first use. */
function indexedDbStorage(indexedDB: IDBFactory): PlatformStorage {
  let opened: Promise<IDBDatabase> | undefined;
  const database = (): Promise<IDBDatabase> => {
    if (opened !== undefined) return opened;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    opened = settled(request);
    return opened;
  };
  const inStore = async <T>(
    mode: IDBTransactionMode,
    act: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const transaction = (await database()).transaction(STORE, mode);
    // Both waits start before either is awaited, so neither event can fire
    // unheard; the call settles once the transaction has committed.
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      };
    });
    const result = settled(act(transaction.objectStore(STORE)));
    await committed;
    return result;
  };
  return {
    async get(key) {
      const value: unknown = await inStore('readonly', (store) =>
        store.get(key),
      );
      return value instanceof Uint8Array ? value : undefined;
    },
    async set(key, bytes) {
      // IndexedDB stores a structured clone, so later changes to `bytes`
      // never reach the stored copy.
      await inStore('readwrite', (store) => store.put(bytes, key));
    },
    async delete(key) {
      await inStore('readwrite', (store) => store.delete(key));
    },
    async keys() {
      // IndexedDB returns keys ascending, which for strings is the order
      // Array.prototype.sort gives (a mutation dropping a sort here
      // survived, #124).
      const keys = await inStore('readonly', (store) => store.getAllKeys());
      return keys.map(String);
    },
  };
}

export function createWebPlatform(host: WebHost): Platform {
  const { document, window, navigator } = host;
  return {
    storage: indexedDbStorage(host.indexedDB),
    notifications: {
      schedule: () => Promise.resolve(NO_NOTIFICATIONS),
      cancel: () => Promise.resolve(NO_NOTIFICATIONS),
    },
    achievements: { unlock: () => Promise.resolve(NO_ACHIEVEMENTS) },
    entitlements: { regions: () => WEB_REGIONS },
    share: {
      async share({ title, text, url }) {
        if (navigator.share === undefined) return NO_SHARE;
        try {
          await navigator.share({ title, text, url });
          return { done: true };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError')
            return SHARE_CLOSED;
          throw error;
        }
      },
    },
    haptics: { pulse: () => NO_HAPTICS },
    lifecycle: {
      onVisibility(listener) {
        let visible = document.visibilityState === 'visible';
        const changed = (): void => {
          const now = document.visibilityState === 'visible';
          if (now === visible) return;
          visible = now;
          listener(now);
        };
        document.addEventListener('visibilitychange', changed);
        return () => {
          document.removeEventListener('visibilitychange', changed);
        };
      },
      onPageHide(listener) {
        const hidden = (): void => {
          listener();
        };
        window.addEventListener('pagehide', hidden);
        return () => {
          window.removeEventListener('pagehide', hidden);
        };
      },
    },
  };
}

/** The web platform over this browser's own globals. */
export function webPlatform(): Platform {
  return createWebPlatform({
    indexedDB: globalThis.indexedDB,
    document: globalThis.document,
    window: globalThis.window,
    navigator: globalThis.navigator,
  });
}
