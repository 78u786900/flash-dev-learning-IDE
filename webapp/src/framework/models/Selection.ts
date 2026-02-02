/**
 * Selection Context - 用戶選中嘅內容（文字、區域、時間等）
 */

export type SelectionType = 
  | 'none' 
  | 'text' 
  | 'region' 
  | 'time_range' 
  | 'pages' 
  | 'cells' 
  | 'slides'

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface TimeRange {
  start: number  // seconds
  end: number    // seconds
}

export interface CellRange {
  sheet: string
  range: string  // e.g. "B2:D10"
}

export interface SelectionContext {
  activeFileId: string | null
  activeNoteId: string | null
  selection: {
    type: SelectionType
    
    // For text selection
    text?: string
    
    // For region selection (images, PDF areas)
    bbox?: BoundingBox
    
    // For audio/video
    timeRange?: TimeRange
    
    // For spreadsheets
    cells?: CellRange[]
    
    // For presentations / PDFs
    pages?: number[]
    slides?: number[]
  }
  
  // Captured screenshot (框選截圖)
  capturedImage?: string
  
  // Context metadata
  metadata?: {
    totalPages?: number
    totalDuration?: number
    language?: string
  }
}

// Helper: 建立空 selection
export function createEmptySelection(): SelectionContext {
  return {
    activeFileId: null,
    activeNoteId: null,
    selection: {
      type: 'none'
    }
  }
}

// Helper: 檢查係咪有選取內容
export function hasSelection(ctx: SelectionContext): boolean {
  if (ctx.selection.type === 'none') return false
  if (ctx.selection.text) return true
  if (ctx.selection.bbox) return true
  if (ctx.selection.timeRange) return true
  if (ctx.selection.cells && ctx.selection.cells.length > 0) return true
  if (ctx.selection.pages && ctx.selection.pages.length > 0) return true
  if (ctx.selection.slides && ctx.selection.slides.length > 0) return true
  if (ctx.capturedImage) return true
  return false
}
