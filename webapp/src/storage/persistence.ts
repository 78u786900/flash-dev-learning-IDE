/**
 * Local persistence for agent memory: notes, timeline, chat history.
 * Uses localStorage; debounced saves to avoid thrashing.
 */

import type { Note } from '../types'
import type { TimelineAction } from '../types'

const KEYS = {
  NOTES: 'learning_ide_notes',
  TIMELINE: 'learning_ide_timeline',
  CHAT: 'learning_ide_chat',
} as const

const TIMELINE_CAP = 200
const CHAT_CAP = 100
const DEBOUNCE_MS = 300

/** Stored chat message (serializable; no blob URLs). imageDataUrl is optional for user messages with attached image. */
export interface StoredChatMessage {
  role: 'user' | 'agent'
  text: string
  /** Data URL (e.g. data:image/png;base64,...) for user-attached image; stored so history shows preview. */
  imageDataUrl?: string
  agentRun?: {
    logs: string[]
    toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string; success: boolean }>
    error?: string
  }
}

/** One chat thread (tab) with its own messages. */
export interface StoredChatThread {
  id: string
  title: string
  messages: StoredChatMessage[]
  createdAt: number
  updatedAt: number
}

let notesSaveTimer: ReturnType<typeof setTimeout> | null = null
let timelineSaveTimer: ReturnType<typeof setTimeout> | null = null
let chatSaveTimer: ReturnType<typeof setTimeout> | null = null

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota or disabled
  }
}

/** Load notes from storage. Returns null if empty or invalid. */
export function loadNotes(): Note[] | null {
  const data = safeParse<Note[] | null>(KEYS.NOTES, null)
  if (!Array.isArray(data) || data.length === 0) return null
  // Basic shape check
  const valid = data.every(
    (n) =>
      n &&
      typeof n.id === 'string' &&
      typeof n.name === 'string' &&
      Array.isArray(n.sections) &&
      typeof n.createdAt === 'number'
  )
  return valid ? data : null
}

/** Save notes (debounced). */
export function saveNotes(notes: Note[]): void {
  if (notesSaveTimer) clearTimeout(notesSaveTimer)
  notesSaveTimer = setTimeout(() => {
    notesSaveTimer = null
    safeSet(KEYS.NOTES, notes)
  }, DEBOUNCE_MS)
}

/** Load timeline from storage. */
export function loadTimeline(): TimelineAction[] {
  const data = safeParse<TimelineAction[]>(KEYS.TIMELINE, [])
  if (!Array.isArray(data)) return []
  const valid = data.filter(
    (t) =>
      t &&
      typeof t.id === 'string' &&
      typeof t.type === 'string' &&
      typeof t.label === 'string' &&
      typeof t.at === 'number'
  )
  return valid.slice(-TIMELINE_CAP)
}

/** Save timeline (debounced, capped). */
export function saveTimeline(timeline: TimelineAction[]): void {
  if (timelineSaveTimer) clearTimeout(timelineSaveTimer)
  timelineSaveTimer = setTimeout(() => {
    timelineSaveTimer = null
    safeSet(KEYS.TIMELINE, timeline.slice(-TIMELINE_CAP))
  }, DEBOUNCE_MS)
}

/** Legacy: load flat chat history (single thread) from storage. */
export function loadChat(): StoredChatMessage[] {
  const data = safeParse<StoredChatMessage[]>(KEYS.CHAT, [])
  if (!Array.isArray(data)) return []
  const valid = data.filter(
    (m) =>
      m &&
      (m.role === 'user' || m.role === 'agent') &&
      typeof m.text === 'string' &&
      (m.imageDataUrl === undefined || (typeof m.imageDataUrl === 'string' && m.imageDataUrl.startsWith('data:image/')))
  )
  return valid.slice(-CHAT_CAP)
}

/** Legacy: save flat chat history (kept for backward compatibility). */
export function saveChat(messages: StoredChatMessage[]): void {
  if (chatSaveTimer) clearTimeout(chatSaveTimer)
  chatSaveTimer = setTimeout(() => {
    chatSaveTimer = null
    safeSet(KEYS.CHAT, messages.slice(-CHAT_CAP))
  }, DEBOUNCE_MS)
}

/** Load multi-chat threads from storage, migrating legacy flat history to a single thread if needed. */
export function loadChatThreads(): StoredChatThread[] {
  const raw = safeParse<unknown>(KEYS.CHAT, [])
  if (Array.isArray(raw) && raw.length && (raw[0] as any)?.messages) {
    const threads = raw as StoredChatThread[]
    return threads
      .filter(
        (t) =>
          t &&
          typeof t.id === 'string' &&
          typeof t.title === 'string' &&
          Array.isArray(t.messages)
      )
      .slice(-CHAT_CAP)
      .map((t) => ({
        ...t,
        messages: t.messages.slice(-CHAT_CAP),
      }))
  }

  // Legacy format: flat array of messages → wrap into a single thread
  const legacyMessages = Array.isArray(raw) ? (raw as StoredChatMessage[]) : loadChat()
  if (!legacyMessages.length) return []
  const now = Date.now()
  return [
    {
      id: `chat-${now}`,
      title: 'Chat 1',
      messages: legacyMessages.slice(-CHAT_CAP),
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/** Save multi-chat threads (debounced, capped). */
export function saveChatThreads(threads: StoredChatThread[]): void {
  if (chatSaveTimer) clearTimeout(chatSaveTimer)
  chatSaveTimer = setTimeout(() => {
    chatSaveTimer = null
    const trimmed = threads
      .slice(-CHAT_CAP)
      .map((t) => ({ ...t, messages: t.messages.slice(-CHAT_CAP) }))
    safeSet(KEYS.CHAT, trimmed)
  }, DEBOUNCE_MS)
}
