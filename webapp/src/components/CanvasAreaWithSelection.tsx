import { useRef, useState, useCallback, useEffect } from 'react'
import html2canvas from 'html2canvas'
import type { CanvasFileType, CanvasToolMode } from './CanvasToolbar'
import { CanvasAreaProvider } from './CanvasAreaContext'
import { CanvasToolbar } from './CanvasToolbar'

/** Single overlay memo: position, size, content */
export interface CanvasOverlayMemo {
  id: string
  x: number
  y: number
  width: number
  height: number
  content: string
}

/** Capture current tab via getDisplayMedia (for PDF in iframe). Requires user to choose "This tab". */
async function captureTabToVideo(video: HTMLVideoElement): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions)
    video.srcObject = stream
    await video.play()
    return stream
  } catch {
    return null
  }
}

const DEFAULT_MEMO_WIDTH = 220
const DEFAULT_MEMO_HEIGHT = 140
const MIN_MEMO_SIZE = 80

interface FloatingMemoProps {
  memo: CanvasOverlayMemo
  onUpdate: (id: string, patch: Partial<CanvasOverlayMemo>) => void
  onRemove: (id: string) => void
  /** Optional callback to get maximum allowed x/y for this memo (to keep within frame). */
  getBounds?: () => { maxX: number; maxY: number } | null
}

function FloatingMemo({ memo, onUpdate, onRemove, getBounds }: FloatingMemoProps) {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 })
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.ide-memo-resize-handle')) return
      e.preventDefault()
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY, left: memo.x, top: memo.y }
    },
    [memo.x, memo.y]
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setResizing(true)
      resizeStart.current = { x: e.clientX, y: e.clientY, width: memo.width, height: memo.height }
    },
    [memo.width, memo.height]
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      let nextX = dragStart.current.left + dx
      let nextY = dragStart.current.top + dy
      const bounds = getBounds?.()
      const maxX = bounds?.maxX ?? Number.POSITIVE_INFINITY
      const maxY = bounds?.maxY ?? Number.POSITIVE_INFINITY
      nextX = Math.max(0, Math.min(nextX, maxX))
      nextY = Math.max(0, Math.min(nextY, maxY))
      onUpdate(memo.id, {
        x: nextX,
        y: nextY,
      })
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, memo.id, onUpdate])

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => {
      const dw = e.clientX - resizeStart.current.x
      const dh = e.clientY - resizeStart.current.y
      onUpdate(memo.id, {
        width: Math.max(MIN_MEMO_SIZE, resizeStart.current.width + dw),
        height: Math.max(MIN_MEMO_SIZE, resizeStart.current.height + dh),
      })
    }
    const onUp = () => setResizing(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizing, memo.id, onUpdate])

  return (
    <div
      className="ide-canvas-memo"
      style={{
        left: memo.x,
        top: memo.y,
        width: memo.width,
        height: memo.height,
      }}
      onMouseDown={handleDragStart}
    >
      <div className="ide-canvas-memo-header">
        <span className="ide-canvas-memo-drag-hint" aria-hidden />
        <button
          type="button"
          className="ide-canvas-memo-close"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(memo.id)
          }}
          title="移除備忘"
          aria-label="移除備忘"
        >
          ×
        </button>
      </div>
      <textarea
        className="ide-canvas-memo-content"
        value={memo.content}
        onChange={(e) => onUpdate(memo.id, { content: e.target.value })}
        placeholder="寫備忘…"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div
        className="ide-memo-resize-handle"
        onMouseDown={handleResizeStart}
        aria-hidden
      />
    </div>
  )
}

interface CanvasAreaWithSelectionProps {
  fileType: CanvasFileType
  onAddSection?: () => void
  onCaptureArea: (dataUrl: string) => void
  /** When true, disable text selection (for PDF/image/video); when false, allow selection for editing (notes) */
  noSelect?: boolean
  /** Optional controlled overlays; if provided, component becomes controlled for memo state. */
  overlays?: CanvasOverlayMemo[]
  /** Called whenever overlays change (drag, resize, edit, add/remove). */
  onOverlaysChange?: (next: CanvasOverlayMemo[]) => void
  children: React.ReactNode
}

export function CanvasAreaWithSelection({
  fileType,
  onAddSection,
  onCaptureArea,
  noSelect = true,
  overlays: controlledOverlays,
  onOverlaysChange,
  children,
}: CanvasAreaWithSelectionProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tabVideoRef = useRef<HTMLVideoElement | null>(null)
  const tabStreamRef = useRef<MediaStream | null>(null)

  /** Tool: cursor (normal), capture (drag area), overlay (add memo). Default is cursor. */
  const [tool, setTool] = useState<CanvasToolMode>('cursor')
  const captureMode = tool === 'capture'

  const [selecting, setSelecting] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null)

  /** Overlay memos (when tool is overlay); position relative to wrap.
   * If controlledOverlays is provided, this component acts as a controlled
   * view of overlays and delegates updates via onOverlaysChange.
   */
  const [uncontrolledOverlays, setUncontrolledOverlays] = useState<CanvasOverlayMemo[]>([])

  const overlays = controlledOverlays ?? uncontrolledOverlays

  const updateOverlaysState = useCallback(
    (updater: (prev: CanvasOverlayMemo[]) => CanvasOverlayMemo[]) => {
      if (controlledOverlays != null && onOverlaysChange) {
        onOverlaysChange(updater(controlledOverlays))
      } else {
        setUncontrolledOverlays(prev => updater(prev))
      }
    },
    [controlledOverlays, onOverlaysChange]
  )


  useEffect(() => {
    if (fileType !== 'pdf') {
      tabStreamRef.current?.getTracks().forEach(t => t.stop())
      tabStreamRef.current = null
    }
    return () => {
      tabStreamRef.current?.getTracks().forEach(t => t.stop())
      tabStreamRef.current = null
    }
  }, [fileType])

  const captureRegion = useCallback(async (clientLeft: number, clientTop: number, width: number, height: number) => {
    const el = contentRef.current
    if (!el) return
    try {
      const canvases = Array.from(el.querySelectorAll('canvas')) as HTMLCanvasElement[]
      if (canvases.length > 0) {
        const selRight = clientLeft + width
        const selBottom = clientTop + height
        const scale = window.devicePixelRatio || 1
        const outW = Math.max(1, Math.round(width * scale))
        const outH = Math.max(1, Math.round(height * scale))
        const out = document.createElement('canvas')
        out.width = outW
        out.height = outH
        const ctx = out.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, outW, outH)
        for (const sourceCanvas of canvases) {
          const rect = sourceCanvas.getBoundingClientRect()
          const iLeft = Math.max(clientLeft, rect.left)
          const iTop = Math.max(clientTop, rect.top)
          const iRight = Math.min(selRight, rect.right)
          const iBottom = Math.min(selBottom, rect.bottom)
          if (iRight <= iLeft || iBottom <= iTop) continue
          const scaleX = sourceCanvas.width / rect.width
          const scaleY = sourceCanvas.height / rect.height
          const cropX = (iLeft - rect.left) * scaleX
          const cropY = (iTop - rect.top) * scaleY
          const cropW = (iRight - iLeft) * scaleX
          const cropH = (iBottom - iTop) * scaleY
          if (cropW < 1 || cropH < 1) continue
          const outX = (iLeft - clientLeft) * scale
          const outY = (iTop - clientTop) * scale
          const outDw = (iRight - iLeft) * scale
          const outDh = (iBottom - iTop) * scale
          ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, outX, outY, outDw, outDh)
        }
        onCaptureArea(out.toDataURL('image/png'))
      } else if (fileType === 'pdf') {
        if (!tabVideoRef.current || !tabStreamRef.current) {
          console.warn('Share this tab first: click once in the area to open the share dialog, then drag to select.')
          return
        }
        const video = tabVideoRef.current
        if (video.readyState < 2) {
          await new Promise<void>(resolve => {
            video.addEventListener('loadeddata', () => resolve(), { once: true })
            setTimeout(resolve, 500)
          })
        }
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (!vw || !vh) {
          console.warn('Tab capture video not ready')
          return
        }
        const scaleX = vw / window.innerWidth
        const scaleY = vh / window.innerHeight
        const cropX = Math.max(0, Math.min(clientLeft * scaleX, vw - 1))
        const cropY = Math.max(0, Math.min(clientTop * scaleY, vh - 1))
        const cropW = Math.max(1, Math.min(width * scaleX, vw - cropX))
        const cropH = Math.max(1, Math.min(height * scaleY, vh - cropY))
        const out = document.createElement('canvas')
        out.width = Math.round(cropW)
        out.height = Math.round(cropH)
        const ctx = out.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height)
        onCaptureArea(out.toDataURL('image/png'))
      } else {
        const bgColor =
          getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#1e1e1e'
        const canvas = await html2canvas(el, {
          useCORS: true,
          allowTaint: true,
          scale: window.devicePixelRatio || 1,
          logging: false,
          backgroundColor: bgColor,
        })
        const elRect = el.getBoundingClientRect()
        const relLeft = clientLeft - elRect.left + el.scrollLeft
        const relTop = clientTop - elRect.top + el.scrollTop
        const scaleX = canvas.width / el.scrollWidth
        const scaleY = canvas.height / el.scrollHeight
        const cropX = Math.max(0, relLeft * scaleX)
        const cropY = Math.max(0, relTop * scaleY)
        const cropW = Math.min(canvas.width - cropX, width * scaleX)
        const cropH = Math.min(canvas.height - cropY, height * scaleY)
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = Math.max(1, Math.round(cropW))
        cropCanvas.height = Math.max(1, Math.round(cropH))
        const ctx = cropCanvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height)
        onCaptureArea(cropCanvas.toDataURL('image/png'))
      }
      if (fileType === 'note') setTool('cursor')
    } catch (err) {
      console.error('Capture failed', err)
    }
  }, [onCaptureArea, fileType])

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (!captureMode || e.button !== 0) return
    if (fileType === 'pdf' && !tabStreamRef.current) {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      video.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none;'
      document.body.appendChild(video)
      const stream = await captureTabToVideo(video)
      if (stream) {
        tabStreamRef.current = stream
        tabVideoRef.current = video
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          stream.getTracks().forEach(t => t.stop())
          tabStreamRef.current = null
          if (tabVideoRef.current?.parentNode) tabVideoRef.current.remove()
          tabVideoRef.current = null
        })
      } else {
        video.remove()
      }
      return
    }
    setSelecting(true)
    setStart({ x: e.clientX, y: e.clientY })
    setCurrent({ x: e.clientX, y: e.clientY })
  }, [captureMode, fileType])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selecting || !start) return
    setCurrent({ x: e.clientX, y: e.clientY })
  }, [selecting, start])

  const handleMouseUp = useCallback(() => {
    if (!selecting || !start || !current) {
      setSelecting(false)
      setStart(null)
      setCurrent(null)
      return
    }
    const left = Math.min(start.x, current.x)
    const top = Math.min(start.y, current.y)
    const width = Math.abs(current.x - start.x)
    const height = Math.abs(current.y - start.y)
    setSelecting(false)
    setStart(null)
    setCurrent(null)
    if (width < 10 || height < 10) return
    captureRegion(left, top, width, height)
  }, [selecting, start, current, captureRegion])

  /** Add overlay memo at position (relative to wrap) */
  const handleOverlayAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (tool !== 'overlay' || !contentRef.current) return
      const content = contentRef.current
      const rect = content.getBoundingClientRect()
      // Coordinates in content scroll space so memos stay anchored to the page even when scrolled.
      const x = e.clientX - rect.left + content.scrollLeft
      const y = e.clientY - rect.top + content.scrollTop
      const id = `memo-${Date.now()}-${Math.random().toString(36).slice(2)}`
      updateOverlaysState((prev) => [
        ...prev,
        { id, x: x - DEFAULT_MEMO_WIDTH / 2, y: y - 24, width: DEFAULT_MEMO_WIDTH, height: DEFAULT_MEMO_HEIGHT, content: '' },
      ])
    },
    [tool, updateOverlaysState]
  )

  const updateOverlay = useCallback((id: string, patch: Partial<CanvasOverlayMemo>) => {
    updateOverlaysState((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [updateOverlaysState])

  const removeOverlay = useCallback((id: string) => {
    updateOverlaysState((prev) => prev.filter((m) => m.id !== id))
  }, [updateOverlaysState])

  let selectionRect: { left: number; top: number; width: number; height: number } | null = null
  if (start && current && wrapRef.current) {
    const wr = wrapRef.current.getBoundingClientRect()
    const left = Math.min(start.x, current.x) - wr.left
    const top = Math.min(start.y, current.y) - wr.top
    selectionRect = {
      left,
      top,
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    }
  }

  return (
    <CanvasAreaProvider value={{ captureMode }}>
      <div ref={wrapRef} className="ide-canvas-area-wrap">
        <div ref={contentRef} className={`ide-canvas-area ${noSelect ? 'ide-canvas-no-select' : ''}`}>
          {children}

          {/* Memos (positioned relative to content so they scroll with it) */}
          {overlays.length > 0 && (
            <div className="ide-canvas-memos-layer" aria-hidden>
              {overlays.map((memo) => (
                <FloatingMemo
                  key={memo.id}
                  memo={memo}
                  onUpdate={updateOverlay}
                  onRemove={removeOverlay}
                  getBounds={() => {
                    const content = contentRef.current
                    if (!content) return null
                    return {
                      maxX: Math.max(0, content.scrollWidth - memo.width),
                      maxY: Math.max(0, content.scrollHeight - memo.height),
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Selection overlay: only active when tool is capture */}
        <div
          className={`ide-canvas-selection-overlay ${captureMode ? 'active' : ''}`}
          title={fileType === 'pdf' ? 'Click once to share this tab, then drag to select area' : undefined}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            if (!captureMode) return
            const content = contentRef.current
            if (!content) return
            content.scrollTop += e.deltaY
            content.scrollLeft += e.deltaX
            e.preventDefault()
          }}
          aria-hidden
        >
          {selectionRect && selectionRect.width >= 2 && selectionRect.height >= 2 && (
            <div
              className="ide-canvas-selection-rect"
              style={{
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
                height: selectionRect.height,
              }}
            />
          )}
        </div>

        {/* Overlay mode: click to add memo */}
        {tool === 'overlay' && (
          <div
            className="ide-canvas-overlay-layer"
            onClick={handleOverlayAreaClick}
            aria-hidden
          />
        )}

        <CanvasToolbar
          fileType={fileType}
          tool={tool}
          onToolChange={setTool}
          onAddSection={onAddSection}
        />
      </div>
    </CanvasAreaProvider>
  )
}
