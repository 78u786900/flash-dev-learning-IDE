/**
 * File persistence via IndexedDB.
 * Stores uploaded file blobs so they survive refresh; supports rename and delete.
 */

import type { DroppedFile } from '../types'

const DB_NAME = 'LearningIDEFiles'
const DB_VERSION = 1
const STORE = 'files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

export interface StoredFileRow {
  id: string
  name: string
  type: string
  size: number
  addedAt: number
  blob: Blob
}

/** Save a file to storage (add or replace). Call after upload; blob is the original File. */
export async function saveFileToStorage(
  id: string,
  name: string,
  type: string,
  size: number,
  addedAt: number,
  blob: Blob
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const row: StoredFileRow = { id, name, type, size, addedAt, blob }
    const req = store.put(row)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve()
    tx.oncomplete = () => db.close()
  })
}

/** Load all files from storage and return as DroppedFile[] (with fresh blob URLs). */
export async function loadFilesFromStorage(): Promise<DroppedFile[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const rows = (req.result ?? []) as StoredFileRow[]
      const files: DroppedFile[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        url: URL.createObjectURL(row.blob),
        size: row.size,
        addedAt: row.addedAt,
      }))
      db.close()
      resolve(files)
    }
    tx.oncomplete = () => db.close()
  })
}

/** Rename a file in storage. */
export async function renameFileInStorage(id: string, newName: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(id)
    getReq.onerror = () => reject(getReq.error)
    getReq.onsuccess = () => {
      const row = getReq.result as StoredFileRow | undefined
      if (!row) {
        db.close()
        reject(new Error(`File not found: ${id}`))
        return
      }
      const updated: StoredFileRow = { ...row, name: newName }
      const putReq = store.put(updated)
      putReq.onerror = () => reject(putReq.error)
      putReq.onsuccess = () => resolve()
    }
    tx.oncomplete = () => db.close()
  })
}

/** Delete a file from storage. Caller should revoke the blob URL before/after. */
export async function deleteFileFromStorage(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve()
    tx.oncomplete = () => db.close()
  })
}
