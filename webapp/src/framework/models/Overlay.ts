/**
 * Overlay Canvas - 覆蓋層系統（可以喺任何檔案/筆記上面顯示內容）
 */

export type OverlayAnchor = 'page' | 'slide' | 'sheet' | 'time' | 'global' | 'note-section'

export interface OverlayAttachment {
  fileId?: string
  noteId?: string
  anchor: OverlayAnchor
  anchorRef: string  // e.g. "page:3", "section:s1", "time:120-180"
}

export interface OverlayPosition {
  x: number
  y: number
}

export interface OverlaySize {
  w: number
  h: number
}

export interface OverlayStyle {
  background: 'transparent' | 'solid' | 'blur'
  border: 'none' | 'thin' | 'highlight' | 'dashed'
  opacity: number
  borderColor?: string
  backgroundColor?: string
}

export type OverlayBlockType = 
  | 'text' 
  | 'markdown' 
  | 'image' 
  | 'audio'
  | 'video'
  | 'code' 
  | 'rendered'

export interface OverlayBlockPayload {
  // For text/markdown
  content?: string
  
  // For image/audio/video
  url?: string
  
  // For code
  language?: 'mermaid' | 'plantuml' | 'svg' | 'javascript' | 'python' | 'tsx'
  source?: string
  renderMode?: 'static' | 'animated' | 'interactive'
  runPolicy?: 'render_only' | 'sandbox_exec'
  
  // For rendered output
  format?: 'svg' | 'png' | 'html' | 'gif'
  artifactUrl?: string
  sourceBlockId?: string
  logs?: string
}

export interface OverlayBlock {
  id: string
  type: OverlayBlockType
  payload: OverlayBlockPayload
  createdAt: number
  updatedAt: number
}

export interface Overlay {
  id: string
  attachedTo: OverlayAttachment
  layer: number  // z-index
  position: OverlayPosition
  size: OverlaySize
  style: OverlayStyle
  blocks: OverlayBlock[]
  createdAt: number
  updatedAt: number
  metadata?: {
    title?: string
    description?: string
    tags?: string[]
    createdBy?: 'user' | 'agent'
    skillName?: string
  }
}

// Helper: 建立文字 overlay
export function createTextOverlay(
  attachedTo: OverlayAttachment,
  text: string,
  position: OverlayPosition,
  size: OverlaySize
): Overlay {
  const now = Date.now()
  return {
    id: `overlay-${now}-${Math.random().toString(36).slice(2)}`,
    attachedTo,
    layer: 10,
    position,
    size,
    style: {
      background: 'solid',
      border: 'thin',
      opacity: 0.95,
      backgroundColor: 'rgba(255, 255, 255, 0.95)'
    },
    blocks: [{
      id: `block-${now}`,
      type: 'text',
      payload: { content: text },
      createdAt: now,
      updatedAt: now
    }],
    createdAt: now,
    updatedAt: now
  }
}

// Helper: 建立 code overlay (for diagrams)
export function createCodeOverlay(
  attachedTo: OverlayAttachment,
  language: 'mermaid' | 'svg' | 'plantuml',
  source: string,
  position: OverlayPosition,
  size: OverlaySize
): Overlay {
  const now = Date.now()
  return {
    id: `overlay-${now}-${Math.random().toString(36).slice(2)}`,
    attachedTo,
    layer: 10,
    position,
    size,
    style: {
      background: 'transparent',
      border: 'none',
      opacity: 1.0
    },
    blocks: [{
      id: `block-${now}`,
      type: 'code',
      payload: { 
        language, 
        source,
        renderMode: 'static',
        runPolicy: 'render_only'
      },
      createdAt: now,
      updatedAt: now
    }],
    createdAt: now,
    updatedAt: now,
    metadata: {
      createdBy: 'agent'
    }
  }
}
