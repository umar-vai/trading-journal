const DB_NAME = 'trading-journal-offline'
const DB_VERSION = 1
const STORE_NAME = 'snapshots'

type JournalSnapshot = {
  strategies: unknown[]
  rules: unknown[]
  trades: unknown[]
  checks: unknown[]
  mistakes: unknown[]
  images: unknown[]
}

type StoredSnapshot = JournalSnapshot & {
  userId: string
  cachedAt: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheJournalSnapshot(userId: string, snapshot: JournalSnapshot) {
  if (!('indexedDB' in window)) return
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ ...snapshot, userId, cachedAt: new Date().toISOString() } satisfies StoredSnapshot)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadJournalSnapshot(userId: string): Promise<StoredSnapshot | null> {
  if (!('indexedDB' in window)) return null
  const db = await openDatabase()
  const result = await new Promise<StoredSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(userId)
    request.onsuccess = () => resolve((request.result as StoredSnapshot | undefined) || null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}

export async function clearJournalSnapshot(userId: string) {
  if (!('indexedDB' in window)) return
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
