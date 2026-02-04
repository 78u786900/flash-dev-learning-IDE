import { Request } from 'express'

export interface UserInfo {
  id: string
  email: string
  name: string
  picture?: string
}

export interface AuthenticatedRequest extends Request {
  user?: UserInfo
  accessToken?: string
  refreshToken?: string
}

// Session type extension
declare module 'express-session' {
  interface SessionData {
    user?: UserInfo
    accessToken?: string
    refreshToken?: string
  }
}

// Data types matching frontend
export interface TranscriptSegment {
  startSeconds: number
  endSeconds: number
  text: string
}

export type TranscriptionStatus = 'idle' | 'processing' | 'done' | 'error'

export interface SectionRecording {
  id: string
  dataUrl: string
  duration?: number
  transcriptionStatus?: TranscriptionStatus
  transcriptLanguage?: string
  transcriptSegments?: TranscriptSegment[]
  transcriptError?: string
}

export type CodeWindowLanguage = 'html' | 'react'
export type CodeWindowAspectRatio = '1:1' | '4:3' | '16:9' | '2:1' | '5:3'
export type CodeWindowModel = 'gemini-3-pro' | 'gemini-3-flash'

export interface SectionCodeWindow {
  id: string
  title?: string
  language: CodeWindowLanguage
  aspectRatio?: CodeWindowAspectRatio
  model?: CodeWindowModel
  source: string
}

export interface Section {
  id: string
  title: string
  content: string
  done: boolean
  recordings?: SectionRecording[]
  codeWindows?: SectionCodeWindow[]
}

export interface Note {
  id: string
  name: string
  sections: Section[]
  createdAt: number
}

export type TimelineActionType =
  | 'created_note'
  | 'added_section'
  | 'dropped_file'
  | 'opened_note'
  | 'opened_file'
  | 'section_done'
  | 'section_edited'
  | 'reading_position'

export interface TimelineAction {
  id: string
  type: TimelineActionType
  label: string
  at: number
}

export interface StoredChatMessage {
  role: 'user' | 'agent'
  text: string
  imageDataUrl?: string
  agentRun?: {
    logs: string[]
    toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string; success: boolean }>
    error?: string
  }
}

export interface StoredChatThread {
  id: string
  title: string
  messages: StoredChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface CanvasOverlayMemo {
  id: string
  x: number
  y: number
  width: number
  height: number
  content: string
}

export interface DroppedFileMetadata {
  id: string
  name: string
  type: string
  size: number
  addedAt: number
  driveFileId?: string // Google Drive file ID
}

// Storage data structure in Google Drive
export interface StorageData {
  notes: Note[]
  timeline: TimelineAction[]
  chatThreads: StoredChatThread[]
  canvasOverlays: Record<string, CanvasOverlayMemo[]>
  fileMetadata: DroppedFileMetadata[]
}
