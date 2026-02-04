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
  /** Transcription workflow state for this recording. */
  transcriptionStatus?: TranscriptionStatus
  /** Auto-detected language code for this recording (e.g. "zh-TW", "en"). */
  transcriptLanguage?: string
  /** Detailed transcript with timestamps for this recording. */
  transcriptSegments?: TranscriptSegment[]
  /** Last error message from transcription, if any. */
  transcriptError?: string
}

export interface Section {
  id: string
  title: string
  content: string
  done: boolean
  /** Optional voice recordings for this section (multiple allowed). */
  recordings?: SectionRecording[]
}

export interface Note {
  id: string
  name: string
  sections: Section[]
  createdAt: number
}

export type TimerPhase = 'idle' | 'work' | 'break'

export interface DroppedFile {
  id: string
  name: string
  type: string
  url: string
  size: number
  addedAt: number
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
