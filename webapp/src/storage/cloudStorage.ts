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
  deleteFileFromStorage as deleteLocalFile
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
 * Save all data to cloud storage
 */
export async function saveAllToCloud(data: CloudStorageData): Promise<boolean> {
  if (!isAuthenticated()) return false
  
  try {
    return await storageApi.saveAll({
      notes: data.notes,
      timeline: data.timeline,
      chatThreads: data.chatThreads,
      canvasOverlays: data.canvasOverlays,
      fileMetadata: [] // File metadata is managed separately
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

export async function loadFiles(): Promise<CloudFile[]> {
  if (isAuthenticated()) {
    try {
      const cloudFiles = await filesApi.list()
      if (cloudFiles && cloudFiles.length > 0) {
        // For cloud files, we need to get blob URLs
        return cloudFiles.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          addedAt: f.addedAt,
          url: f.url || '', // Will be fetched on demand
          driveFileId: f.driveFileId
        }))
      }
    } catch (error) {
      console.error('Cloud load files failed:', error)
    }
  }
  return loadLocalFiles()
}

export async function uploadFile(file: File): Promise<CloudFile | null> {
  const id = `f${Date.now()}_${Math.random().toString(36).slice(2)}`
  const addedAt = Date.now()
  
  if (isAuthenticated()) {
    try {
      const uploaded = await filesApi.upload(file)
      if (uploaded) {
        return {
          id: uploaded.id,
          name: uploaded.name,
          type: uploaded.type,
          size: uploaded.size,
          addedAt: uploaded.addedAt,
          url: uploaded.url,
          driveFileId: uploaded.driveFileId
        }
      }
    } catch (error) {
      console.error('Cloud upload failed:', error)
    }
  }
  
  // Fallback to local storage
  try {
    await saveLocalFile(id, file.name, file.type, file.size, addedAt, file)
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
      return await filesApi.rename(driveFileId, newName)
    } catch (error) {
      console.error('Cloud rename failed:', error)
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
      return await filesApi.delete(driveFileId)
    } catch (error) {
      console.error('Cloud delete failed:', error)
    }
  }
  
  try {
    await deleteLocalFile(id)
    return true
  } catch (error) {
    console.error('Local delete failed:', error)
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
 * Sync local data to cloud (for first-time sync after login)
 */
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
