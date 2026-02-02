export type CanvasFileType = 'note' | 'pdf' | 'image' | 'video' | 'other'

/** Tool mode for the floating toolbar: cursor (normal), capture (drag area), overlay (add memo) */
export type CanvasToolMode = 'cursor' | 'capture' | 'overlay'

interface CanvasToolbarProps {
  fileType: CanvasFileType
  /** Current tool; one of cursor, capture, overlay */
  tool: CanvasToolMode
  onToolChange: (tool: CanvasToolMode) => void
  onAddSection?: () => void
}

const ICON_SIZE = 20

/** Cursor/pointer icon – normal selection mode */
function IconCursor() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l7.07 16.97 2.51-5.39 5.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  )
}

/** Crop/selection rectangle icon – drag area to capture */
function IconCapture() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

/** Sticky note / memo icon – add overlay */
function IconOverlay() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
      <polyline points="14.5 2 14.5 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  )
}

/** Plus icon – add section (note only) */
function IconPlus() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function CanvasToolbar({ fileType, tool, onToolChange, onAddSection }: CanvasToolbarProps) {
  return (
    <div className="ide-canvas-toolbar">
      <div className="ide-canvas-toolbar-left">
        {fileType === 'note' && (
          <>
            <button type="button" className="ide-canvas-toolbar-btn" onClick={onAddSection} title="加章節">
              <IconPlus />
              <span className="ide-canvas-toolbar-label">加章節</span>
            </button>
          </>
        )}
        {fileType === 'pdf' && (
          <span className="ide-canvas-toolbar-label">PDF</span>
        )}
        {fileType === 'image' && (
          <span className="ide-canvas-toolbar-label">圖片</span>
        )}
        {fileType === 'video' && (
          <span className="ide-canvas-toolbar-label">影片</span>
        )}
        {fileType === 'other' && (
          <span className="ide-canvas-toolbar-label">檔案</span>
        )}
      </div>
      <div className="ide-canvas-toolbar-right ide-canvas-toolbar-tools">
        <button
          type="button"
          className={`ide-canvas-toolbar-btn ide-canvas-toolbar-tool ${tool === 'cursor' ? 'active' : ''}`}
          onClick={() => onToolChange('cursor')}
          title="游標（一般選取）"
          aria-pressed={tool === 'cursor'}
        >
          <IconCursor />
        </button>
        <button
          type="button"
          className={`ide-canvas-toolbar-btn ide-canvas-toolbar-tool ide-canvas-toolbar-capture ${tool === 'capture' ? 'active' : ''}`}
          onClick={() => onToolChange('capture')}
          title="框選區域 → 截圖送俾 AI"
          aria-pressed={tool === 'capture'}
        >
          <IconCapture />
        </button>
        <button
          type="button"
          className={`ide-canvas-toolbar-btn ide-canvas-toolbar-tool ${tool === 'overlay' ? 'active' : ''}`}
          onClick={() => onToolChange('overlay')}
          title="加備忘（可拖曳、縮放）"
          aria-pressed={tool === 'overlay'}
        >
          <IconOverlay />
        </button>
      </div>
    </div>
  )
}
