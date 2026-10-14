/**
 * A small on-device copy of the brain (IndexedDB), so Sinapsi opens and can be
 * browsed without a connection. Written after every successful load, read only
 * when the network fails. Cleared on sign-out.
 */
const DB = "sinapsi-offline";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOffline(key: string, value: unknown) {
  try {
    await tx("readwrite", (s) => s.put(value, key));
  } catch {
    /* private mode or quota: the app simply has no offline copy */
  }
}

export async function readOffline<T>(key: string): Promise<T | undefined> {
  try {
    return (await tx("readonly", (s) => s.get(key))) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function clearOffline() {
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* nothing to clear */
  }
}

type Listener = (offline: boolean) => void;
const listeners = new Set<Listener>();
let usingCopy = false;

/** True while the screen shows the saved copy because the network failed. */
export function onOfflineCopy(listener: Listener) {
  listeners.add(listener);
  listener(usingCopy);
  return () => {
    listeners.delete(listener);
  };
}

function setUsingCopy(value: boolean) {
  if (usingCopy === value) return;
  usingCopy = value;
  listeners.forEach((l) => l(value));
}

/**
 * Runs a loader; on success stores the result, on failure (e.g. no network)
 * returns the stored copy if there is one.
 */
export async function withOffline<T>(key: string, load: () => Promise<T>): Promise<T> {
  // Known offline (airplane mode, no signal): show the copy at once instead of waiting for retries.
  if (!isOnline()) {
    const copy = await readOffline<T>(key);
    if (copy !== undefined) {
      setUsingCopy(true);
      return copy;
    }
  }
  try {
    const value = await load();
    void saveOffline(key, value);
    setUsingCopy(false);
    return value;
  } catch (error) {
    const copy = await readOffline<T>(key);
    if (copy === undefined) throw error;
    setUsingCopy(true);
    return copy;
  }
}

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Registers the service worker, except inside the Lovable editor preview and in development. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const host = location.hostname;
  const preview =
    window.self !== window.top || /lovableproject(-dev)?\.com$|^id-preview--/.test(host);
  if (preview || import.meta.env.DEV) return;
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}
