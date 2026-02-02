export interface Section {
  id: string
  title: string
  content: string
  done: boolean
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
