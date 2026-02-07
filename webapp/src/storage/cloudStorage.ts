/**
 * Cloud storage layer using Google Drive via backend API.
 * Falls back to local storage when not authenticated.
 */

import type { Note, TimelineAction, DroppedFile } from '../types'
import type { StoredChatThread } from './persistence'
import type { CanvasOverlayMemo } from '../components/CanvasAreaWithSelection'
import { storageApi, filesApi, isAuthenticated } from '../api/client'
import {
  loadNotes as loadLocalNotes,
  saveNotes as saveLocalNotes,
  loadTimeline as loadLocalTimeline,
  saveTimeline as saveLocalTimeline,
  loadChatThreads as loadLocalChatThreads,
  saveChatThreads as saveLocalChatThreads,
  loadCanvasOverlays as loadLocalCanvasOverlays,
  saveCanvasOverlays as saveLocalCanvasOverlays
} from './persistence'
import {
  loadFilesFromStorage as loadLocalFiles,
  saveFileToStorage as saveLocalFile,
  renameFileInStorage as renameLocalFile,
  deleteFileFromStorage as deleteLocalFile,
  getFileBlob as getLocalFileBlob
} from './fileStorage'

// Debounce timers
let notesSaveTimer: ReturnType<typeof setTimeout> | null = null
let timelineSaveTimer: ReturnType<typeof setTimeout> | null = null
let chatSaveTimer: ReturnType<typeof setTimeout> | null = null
let overlaysSaveTimer: ReturnType<typeof setTimeout> | null = null

const DEBOUNCE_MS = 500 // Longer debounce for cloud saves

export interface CloudStorageData {
  notes: Note[]
  timeline: TimelineAction[]
  chatThreads: StoredChatThread[]
  canvasOverlays: Record<string, CanvasOverlayMemo[]>
}

/**
 * Load all data from cloud storage
 */
export async function loadAllFromCloud(): Promise<CloudStorageData | null> {
  if (!isAuthenticated()) return null
  
  try {
    const data = await storageApi.loadAll()
    if (!data) return null
    
    return {
      notes: data.notes || [],
      timeline: data.timeline || [],
      chatThreads: data.chatThreads || [],
      canvasOverlays: data.canvasOverlays || {}
    }
  } catch (error) {
    console.error('Failed to load from cloud:', error)
    return null
  }
}

/**
 * Save all data to cloud storage.
 * Preserves fileMetadata (managed by files API) by loading current storage first.
 */
export async function saveAllToCloud(data: CloudStorageData): Promise<boolean> {
  if (!isAuthenticated()) return false
  
  try {
    const current = await storageApi.loadAll()
    const fileMetadata = current?.fileMetadata ?? []
    return await storageApi.saveAll({
      notes: data.notes,
      timeline: data.timeline,
      chatThreads: data.chatThreads,
      canvasOverlays: data.canvasOverlays,
      fileMetadata
    })
  } catch (error) {
    console.error('Failed to save to cloud:', error)
    return false
  }
}

// Notes
export async function loadNotes(): Promise<Note[] | null> {
  if (isAuthenticated()) {
    try {
      const notes = await storageApi.loadNotes()
      if (notes && notes.length > 0) return notes
    } catch (error) {
      console.error('Cloud load notes failed:', error)
    }
  }
  return loadLocalNotes()
}

export function saveNotes(notes: Note[]): void {
  // Always save locally first
  saveLocalNotes(notes)
  
  // Also save to cloud if authenticated (debounced)
  if (isAuthenticated()) {
    if (notesSaveTimer) clearTimeout(notesSaveTimer)
    notesSaveTimer = setTimeout(async () => {
      notesSaveTimer = null
      try {
        await storageApi.saveNotes(notes)
      } catch (error) {
        console.error('Cloud save notes failed:', error)
      }
    }, DEBOUNCE_MS)
  }
}

// Timeline
export async function loadTimeline(): Promise<TimelineAction[]> {
  if (isAuthenticated()) {
    try {
      const timeline = await storageApi.loadTimeline()
      if (timeline) return timeline
    } catch (error) {
      console.error('Cloud load timeline failed:', error)
    }
  }
  return loadLocalTimeline()
}

export function saveTimeline(timeline: TimelineAction[]): void {
  // Always save locally first
  saveLocalTimeline(timeline)
  
  // Also save to cloud if authenticated (debounced)
  if (isAuthenticated()) {
    if (timelineSaveTimer) clearTimeout(timelineSaveTimer)
    timelineSaveTimer = setTimeout(async () => {
      timelineSaveTimer = null
      try {
        await storageApi.saveTimeline(timeline)
      } catch (error) {
        console.error('Cloud save timeline failed:', error)
      }
    }, DEBOUNCE_MS)
  }
}

// Chat threads
export async function loadChatThreads(): Promise<StoredChatThread[]> {
  if (isAuthenticated()) {
    try {
      const threads = await storageApi.loadChat()
      if (threads && threads.length > 0) return threads
    } catch (error) {
      console.error('Cloud load chat failed:', error)
    }
  }
  return loadLocalChatThreads()
}

export function saveChatThreads(threads: StoredChatThread[]): void {
  // Always save locally first
  saveLocalChatThreads(threads)
  
  // Also save to cloud if authenticated (debounced)
  if (isAuthenticated()) {
    if (chatSaveTimer) clearTimeout(chatSaveTimer)
    chatSaveTimer = setTimeout(async () => {
      chatSaveTimer = null
      try {
        await storageApi.saveChat(threads)
      } catch (error) {
        console.error('Cloud save chat failed:', error)
      }
    }, DEBOUNCE_MS)
  }
}

// Canvas overlays
export async function loadCanvasOverlays(): Promise<Record<string, CanvasOverlayMemo[]>> {
  if (isAuthenticated()) {
    try {
      const overlays = await storageApi.loadOverlays()
      if (overlays && Object.keys(overlays).length > 0) {
        // Cast to proper type
        const typed: Record<string, CanvasOverlayMemo[]> = {}
        for (const [key, arr] of Object.entries(overlays)) {
          if (Array.isArray(arr)) {
            typed[key] = arr.map((m: any) => ({
              id: String(m.id ?? `memo-${Date.now()}`),
              x: typeof m.x === 'number' ? m.x : 0,
              y: typeof m.y === 'number' ? m.y : 0,
              width: typeof m.width === 'number' ? m.width : 220,
              height: typeof m.height === 'number' ? m.height : 140,
              content: typeof m.content === 'string' ? m.content : ''
            }))
          }
        }
        return typed
      }
    } catch (error) {
      console.error('Cloud load overlays failed:', error)
    }
  }
  
  const local = loadLocalCanvasOverlays()
  const typed: Record<string, CanvasOverlayMemo[]> = {}
  for (const [key, arr] of Object.entries(local)) {
    if (Array.isArray(arr)) {
      typed[key] = arr.map((m: any) => ({
        id: String(m.id ?? `memo-${Date.now()}`),
        x: typeof m.x === 'number' ? m.x : 0,
        y: typeof m.y === 'number' ? m.y : 0,
        width: typeof m.width === 'number' ? m.width : 220,
        height: typeof m.height === 'number' ? m.height : 140,
        content: typeof m.content === 'string' ? m.content : ''
      }))
    }
  }
  return typed
}

export function saveCanvasOverlays(overlays: Record<string, CanvasOverlayMemo[]>): void {
  // Convert to serializable format
  const plain: Record<string, unknown[]> = {}
  for (const [key, arr] of Object.entries(overlays)) {
    plain[key] = arr.map((m) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      width: m.width,
      height: m.height,
      content: m.content
    }))
  }
  
  // Always save locally first
  saveLocalCanvasOverlays(plain)
  
  // Also save to cloud if authenticated (debounced)
  if (isAuthenticated()) {
    if (overlaysSaveTimer) clearTimeout(overlaysSaveTimer)
    overlaysSaveTimer = setTimeout(async () => {
      overlaysSaveTimer = null
      try {
        await storageApi.saveOverlays(overlays)
      } catch (error) {
        console.error('Cloud save overlays failed:', error)
      }
    }, DEBOUNCE_MS)
  }
}

// Files
export interface CloudFile extends DroppedFile {
  driveFileId?: string
}

/**
 * Load files: ONLY from local storage. Never load from cloud in this step.
 * Cloud sync is done separately in syncLocalWithCloud().
 */
export async function loadFiles(): Promise<CloudFile[]> {
  const localFiles = await loadLocalFiles()
  return localFiles.map((f) => ({ ...f, driveFileId: undefined }))
}

/**
 * Sync local files with cloud (runs after load when authenticated).
 * - If cloud has more files → fetch those to local and add to list
 * - If local has more files → upload those to cloud, load from local
 * - Updates driveFileId on matched files
 * Returns the merged list for state update.
 */
export async function syncLocalWithCloud(localFiles: CloudFile[]): Promise<CloudFile[]> {
  if (!isAuthenticated()) return localFiles

  try {
    const driveFiles = await filesApi.list()
    const driveById = new Map((driveFiles ?? []).map((d) => [d.id, d]))
    const localById = new Map(localFiles.map((f) => [f.id, f]))
    const result = localFiles.map((f) => ({ ...f }))

    for (const f of result) {
      const d = driveById.get(f.id)
      if (d) {
        f.driveFileId = d.driveFileId
        driveById.delete(f.id)
      }
    }

    for (const [, d] of driveById) {
      if (localById.has(d.id)) continue
      const blob = await filesApi.download(d.id).catch(() => null)
      let url = ''
      if (blob) {
        try {
          await saveLocalFile(d.id, d.name, d.type, d.size, d.addedAt, blob)
        } catch {}
        url = URL.createObjectURL(blob)
      }
      const cloudFile: CloudFile = {
        id: d.id,
        name: d.name,
        type: d.type,
        size: d.size,
        addedAt: d.addedAt,
        url,
        driveFileId: d.driveFileId
      }
      result.push(cloudFile)
      localById.set(d.id, cloudFile)
    }

    for (const f of result) {
      if (f.driveFileId) continue
      if (!f.url?.startsWith('blob:')) continue
      try {
        const blob = await fetch(f.url).then((r) => r.blob())
        const fileObj = new File([blob], f.name, { type: f.type })
        const uploaded = await uploadFileForSync(f.id, f.addedAt, fileObj)
        if (uploaded) f.driveFileId = uploaded.driveFileId
      } catch (e) {
        console.warn('Sync upload failed:', f.name, e)
      }
    }

    result.sort((a, b) => a.addedAt - b.addedAt)
    return result
  } catch (error) {
    console.error('Cloud sync failed:', error)
    return localFiles
  }
}

/** Verify a file exists on cloud by id (e.g. after upload). */
export async function verifyFileOnCloud(id: string): Promise<boolean> {
  if (!isAuthenticated()) return false
  try {
    const list = await filesApi.list()
    return list?.some((f) => f.id === id) ?? false
  } catch {
    return false
  }
}

export async function uploadFile(file: File): Promise<CloudFile | null> {
  return uploadFileWithProgress(file, () => {})
}

/** Upload for sync: preserve local id and addedAt so Drive metadata matches local. */
export async function uploadFileForSync(
  id: string,
  addedAt: number,
  file: File
): Promise<CloudFile | null> {
  if (!isAuthenticated()) return null
  try {
    const uploaded = await filesApi.upload(file, { id, addedAt })
    if (!uploaded) return null
    try {
      await saveLocalFile(uploaded.id, uploaded.name, uploaded.type, uploaded.size, uploaded.addedAt, file)
    } catch (e) {
      console.warn('Cache file to IndexedDB failed:', e)
    }
    return {
      id: uploaded.id,
      name: uploaded.name,
      type: uploaded.type,
      size: uploaded.size,
      addedAt: uploaded.addedAt,
      url: URL.createObjectURL(file),
      driveFileId: uploaded.driveFileId
    }
  } catch (error) {
    console.error('Cloud upload (sync) failed:', error)
    return null
  }
}

export async function uploadFileWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<CloudFile | null> {
  const id = `f${Date.now()}_${Math.random().toString(36).slice(2)}`
  const addedAt = Date.now()
  
  if (isAuthenticated()) {
    try {
      const uploaded = await filesApi.uploadWithProgress(file, onProgress)
      if (uploaded) {
        const exists = await verifyFileOnCloud(uploaded.id)
        if (!exists) {
          console.warn('Upload succeeded but file not found on cloud:', uploaded.id)
        }
        try {
          await saveLocalFile(
            uploaded.id,
            uploaded.name,
            uploaded.type,
            uploaded.size,
            uploaded.addedAt,
            file
          )
        } catch (e) {
          console.warn('Cache file to IndexedDB failed:', e)
        }
        const cachedUrl = URL.createObjectURL(file)
        return {
          id: uploaded.id,
          name: uploaded.name,
          type: uploaded.type,
          size: uploaded.size,
          addedAt: uploaded.addedAt,
          url: cachedUrl,
          driveFileId: uploaded.driveFileId
        }
      }
    } catch (error) {
      console.error('Cloud upload failed:', error)
    }
  }
  
  onProgress(0)
  try {
    await saveLocalFile(id, file.name, file.type, file.size, addedAt, file)
    onProgress(100)
    return {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      addedAt,
      url: URL.createObjectURL(file)
    }
  } catch (error) {
    console.error('Local file save failed:', error)
    return null
  }
}

export async function renameFile(id: string, newName: string, driveFileId?: string): Promise<boolean> {
  if (isAuthenticated() && driveFileId) {
    try {
      const exists = await verifyFileOnCloud(id)
      if (exists) {
        const ok = await filesApi.rename(driveFileId, newName)
        if (!ok) return false
      }
      await renameLocalFile(id, newName)
      return true
    } catch (error) {
      console.error('Cloud rename failed:', error)
      return false
    }
  }
  
  try {
    await renameLocalFile(id, newName)
    return true
  } catch (error) {
    console.error('Local rename failed:', error)
    return false
  }
}

export async function deleteFile(id: string, driveFileId?: string): Promise<boolean> {
  if (isAuthenticated() && driveFileId) {
    try {
      const exists = await verifyFileOnCloud(id)
      if (exists) {
        const ok = await filesApi.delete(driveFileId)
        if (!ok) return false
      }
    } catch (error) {
      console.error('Cloud delete failed:', error)
      return false
    }
  }

  try {
    await deleteLocalFile(id)
    return true
  } catch {
    return false
  }
}

export async function getFileUrl(_id: string, driveFileId?: string): Promise<string | null> {
  if (isAuthenticated() && driveFileId) {
    try {
      return await filesApi.getUrl(driveFileId)
    } catch (error) {
      console.error('Get file URL failed:', error)
    }
  }
  return null
}

/**
 * Fetch file from cloud and cache to IndexedDB for instant load on next view.
 * Returns blob URL when successful.
 */
export async function fetchFileAndCache(
  id: string,
  name: string,
  type: string,
  size: number,
  addedAt: number
): Promise<string | null> {
  const cached = await getLocalFileBlob(id)
  if (cached) return URL.createObjectURL(cached)

  const blob = await filesApi.download(id)
  if (!blob) return null
  try {
    await saveLocalFile(id, name, type, size, addedAt, blob)
  } catch (e) {
    console.warn('Cache fetched file to IndexedDB failed:', e)
  }
  return URL.createObjectURL(blob)
}

export async function syncLocalToCloud(): Promise<boolean> {
  if (!isAuthenticated()) return false
  
  try {
    // Load local data
    const localNotes = loadLocalNotes() || []
    const localTimeline = loadLocalTimeline()
    const localChat = loadLocalChatThreads()
    const localOverlays = loadLocalCanvasOverlays()
    
    // Load cloud data
    const cloudData = await loadAllFromCloud()
    
    // If cloud is empty, upload local data
    if (!cloudData || (cloudData.notes.length === 0 && localNotes.length > 0)) {
      const typed: Record<string, CanvasOverlayMemo[]> = {}
      for (const [key, arr] of Object.entries(localOverlays)) {
        if (Array.isArray(arr)) {
          typed[key] = arr.map((m: any) => ({
            id: String(m.id ?? `memo-${Date.now()}`),
            x: typeof m.x === 'number' ? m.x : 0,
            y: typeof m.y === 'number' ? m.y : 0,
            width: typeof m.width === 'number' ? m.width : 220,
            height: typeof m.height === 'number' ? m.height : 140,
            content: typeof m.content === 'string' ? m.content : ''
          }))
        }
      }
      
      await saveAllToCloud({
        notes: localNotes,
        timeline: localTimeline,
        chatThreads: localChat,
        canvasOverlays: typed
      })
      console.log('Synced local data to cloud')
    }
    
    return true
  } catch (error) {
    console.error('Sync failed:', error)
    return false
  }
}
