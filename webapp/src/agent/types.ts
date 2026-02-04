import type { Note, DroppedFile, CodeWindowLanguage } from '../types'

/** Context passed to the agent (current note, file, selection, etc.) */
export interface AgentContext {
  /** Current note when canvas is showing a note */
  note?: Note
  /** Current file when canvas is showing a dropped file */
  file?: DroppedFile
  /** Type of content in the middle: note | pdf | image | video | other */
  fileType?: 'note' | 'pdf' | 'image' | 'video' | 'other'
  /** User-selected text (e.g. from PDF or note) */
  selection?: string
  /** Current PDF page number (1-based) */
  pageNumber?: number
  /** Full text of current PDF page (when available) */
  pageText?: string
  /** Optional: inline image URL for image tools */
  imageUrl?: string
  /** PDF page texts by page number (1-based), when a PDF is open */
  pdfPageTexts?: Record<number, string>
  /** Total number of PDF pages (when PDF is open) */
  totalPdfPages?: number
  /** Chapter boundaries from PDF outline/TOC (title + start page). Use to get page range for "chapter 1" etc. */
  pdfChapters?: Array<{ title: string; page: number }>
  /** Create a new note with the given name; returns the new Note so tools in the same run can add sections to it (context.notes is a snapshot and does not include the new note until next render). */
  createNote?: (name: string) => Note
  /** Set by create_note tool so getNote() can resolve the newly created note by id in the same agent run. */
  lastCreatedNote?: Note
  /** Get PDF page text on demand (no pre-load). When a tool needs page N, call this with current file URL and page number. */
  getPdfPageTextOnDemand?: (fileUrl: string, pageNumber: number) => Promise<string>
  /** Get rendered PDF page image (PNG data URL) on demand so page tools can also \"see\" diagrams / non-text content. */
  getPdfPageImageOnDemand?: (fileUrl: string, pageNumber: number) => Promise<string>
  /** All notes (for search_sections across notes, rename_note, delete_note). */
  notes?: Note[]
  /** All dropped/opened files in the workspace (for search_workspace: treat whole workspace as search engine). */
  files?: DroppedFile[]
  /** Recent timeline entries (e.g. last 10). Includes "Reading: file, page N" when user stops scrolling; agent can read this to know what user is currently reading. */
  timeline?: Array<{ type: string; label: string; at: number }>
  /** When set, search_workspace can use semantic search (mode=semantic). Embeds query + chunks via Gemini and returns similarity scores. */
  embedForSearch?: (query: string, documents: string[]) => Promise<number[]>
}

/** Result of executing one tool */
export interface ToolResult {
  success: boolean
  /** Text to show in chat or to send back to the model */
  text?: string
  /** Action for the app to apply (e.g. add section to note) */
  action?: ToolResultAction
  error?: string
}

/** Actions the app can apply after a tool run */
export type ToolResultAction =
  | { type: 'add_section'; noteId: string; title: string; content: string }
  | { type: 'update_section'; noteId: string; sectionId: string; title?: string; content?: string }
  | { type: 'merge_sections'; noteId: string; sectionIds: string[]; newTitle: string; content: string }
  | { type: 'reorder_sections'; noteId: string; sectionIds: string[] }
  | { type: 'rename_note'; noteId: string; name: string }
  | { type: 'delete_note'; noteId: string }
  | { type: 'delete_section'; noteId: string; sectionIds: string[] }
  /** Upsert (create) a code render window attached to a specific section (HTML / React snippet). */
  | {
      type: 'upsert_code_window'
      noteId: string
      sectionId: string
      language: CodeWindowLanguage
      title?: string
      source: string
      /** Optional preferred aspect ratio for the preview (UI only). */
      aspectRatio?: '1:1' | '4:3' | '16:9' | '2:1' | '5:3'
      /** Optional preferred Gemini model for future inline generation (UI only). */
      model?: 'gemini-3-pro' | 'gemini-3-flash'
    }

/** Gemini function declaration shape */
export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}
