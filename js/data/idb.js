/** تخزين محلي دائم (IndexedDB) للحزمة المشفّرة وبعض الردود: يعمل التطبيق والبحث دون أي طلب شبكة بعد أول تحميل.
 *  كل الدوال آمنة: عند أي خطأ (وضع خاص، منع التخزين) تعيد null ولا يتعطل شيء. */
const DB = 'botrm', STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(key) {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function idbSet(key, value) {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    });
  } catch { return false; }
}
