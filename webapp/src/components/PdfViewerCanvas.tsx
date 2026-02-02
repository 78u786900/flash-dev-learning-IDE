import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page } from 'react-pdf'
import * as pdfjs from 'pdfjs-dist'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Must set in same module as <Document>/<Page> so react-pdf's default does not win (see react-pdf README).
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs'

interface PdfViewerCanvasProps {
  url: string
  className?: string
  /** Called when the user scrolls and a different page becomes the one in view (agent uses this to know current file + page). */
  onPageInView?: (pageNumber: number) => void
}

export function PdfViewerCanvas({ url, className, onPageInView }: PdfViewerCanvasProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fileSource, setFileSource] = useState<{ url: string } | { data: Uint8Array } | null>(
    url.startsWith('blob:') ? null : { url }
  )
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefsRef = useRef<(HTMLDivElement | null)[]>([])
  const reportedPageRef = useRef<number>(1)
  const visibilityRef = useRef<Record<number, number>>({})

  useEffect(() => {
    setNumPages(0)
    setLoadError(null)
    if (url.startsWith('blob:')) {
      setFileSource(null)
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          setFileSource({ data: new Uint8Array(buf) })
        })
        .catch((err) => {
          setLoadError(err?.message ?? 'Failed to load PDF.')
        })
    } else {
      setFileSource({ url })
    }
  }, [url])

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
    pageRefsRef.current = []
  }, [])

  // When user stops scrolling, detect which page is most in view and notify (timeline stores this so agent knows what user is reading)
  const SCROLL_STOP_MS = 400
  useEffect(() => {
    if (!onPageInView || numPages === 0) return
    const root = scrollContainerRef.current
    if (!root) return
    let observer: IntersectionObserver | null = null
    let scrollStopTimeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutId = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const pageNum = e.target.getAttribute('data-page-number')
            if (pageNum) visibilityRef.current[Number(pageNum)] = e.intersectionRatio
          }
          const vis = visibilityRef.current
          const n = numPages
          let best = 1
          let bestRatio = vis[1] ?? 0
          for (let p = 1; p <= n; p++) {
            const r = vis[p] ?? 0
            if (r > bestRatio) {
              bestRatio = r
              best = p
            }
          }
          if (best < 1) return
          if (scrollStopTimeoutId) clearTimeout(scrollStopTimeoutId)
          scrollStopTimeoutId = setTimeout(() => {
            scrollStopTimeoutId = null
            if (best !== reportedPageRef.current) {
              reportedPageRef.current = best
              onPageInView(best)
            }
          }, SCROLL_STOP_MS)
        },
        { root, rootMargin: '0px', threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
      )
      for (let i = 0; i < numPages; i++) {
        const el = pageRefsRef.current[i]
        if (el) observer!.observe(el)
      }
    }, 100)
    return () => {
      clearTimeout(timeoutId)
      if (scrollStopTimeoutId) clearTimeout(scrollStopTimeoutId)
      if (observer) observer.disconnect()
    }
  }, [numPages, onPageInView])

  if (fileSource === null && url.startsWith('blob:')) {
    return (
      <div className={className ?? 'ide-pdf-viewer-canvas'}>
        <div className="ide-pdf-loading">Loading PDF…</div>
      </div>
    )
  }

  if (loadError && !fileSource) {
    return (
      <div className={className ?? 'ide-pdf-viewer-canvas'}>
        <div className="ide-pdf-error" title={loadError}>{loadError}</div>
      </div>
    )
  }

  return (
    <div className={className ?? 'ide-pdf-viewer-canvas'} ref={scrollContainerRef} style={{ overflow: 'auto', flex: 1, minHeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Document
        file={fileSource!}
        onLoadSuccess={onLoadSuccess}
        onLoadError={(e) => {
          setLoadError(e?.message ?? 'Failed to load PDF.')
          setNumPages(0)
        }}
        loading={
          <div className="ide-pdf-loading">Loading PDF…</div>
        }
        error={
          <div className="ide-pdf-error" title={loadError ?? undefined}>
            {loadError ?? 'Failed to load PDF.'}
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              pageRefsRef.current[i] = el
            }}
            data-page-number={i + 1}
            className="ide-pdf-page-wrapper"
          >
            <Page
              pageNumber={i + 1}
              width={undefined}
              scale={1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="ide-pdf-page"
            />
          </div>
        ))}
      </Document>
    </div>
  )
}
