import { useEffect } from 'react'
import type { DroppedFile } from '../types'

interface FileViewerProps {
  file: DroppedFile
  /** Called as PDF text is extracted: first time with totalPages, then each chunk of pages. Merge into state so first N pages are usable early. */
  onPdfTextLoaded?: (pages: Record<number, string>, fileId: string, totalPages?: number) => void
  /** Called when PDF outline/TOC is available (chapter title + start page). Use to determine chapter page ranges. */
  onPdfChaptersLoaded?: (chapters: { title: string; page: number }[], fileId: string, totalPages?: number) => void
  /** Current PDF page the user is viewing (1-based). Agent uses this for "this page". */
  currentPdfPage?: number
  /** Total PDF pages when known. */
  totalPdfPages?: number
  /** Called when the user changes the viewed page. Updates context so agent knows "this page". */
  onPdfPageChange?: (page: number) => void
  /** When scroll stops (only with custom viewer), store current file + page in timeline. With native PDF iframe this is not used. */
  onReadingPosition?: (payload: { fileId: string; fileName: string; page: number }) => void
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg']
function isImage(type: string, name: string): boolean {
  if (IMAGE_TYPES.some(t => type.toLowerCase().startsWith(t))) return true
  const ext = name.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext ?? '')
}

function isVideo(type: string, name: string): boolean {
  if (VIDEO_TYPES.some(t => type.toLowerCase().startsWith(t))) return true
  const ext = name.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'ogg', 'mov'].includes(ext ?? '')
}

function isPdf(type: string, name: string): boolean {
  if (type.toLowerCase().includes('pdf')) return true
  return name.toLowerCase().endsWith('.pdf')
}

const PDF_TEXT_CHUNK_SIZE = 10

async function getPageIndexFromDest(
  pdf: { getDestination: (d: unknown) => Promise<unknown>; getPageIndex: (r: unknown) => Promise<number> },
  dest: unknown
): Promise<number> {
  try {
    let ref: unknown[] | null = null
    if (typeof dest === 'string') ref = (await pdf.getDestination(dest)) as unknown[] | null
    else if (Array.isArray(dest) && dest.length) ref = dest as unknown[]
    if (ref?.[0]) {
      const pageIndex = await pdf.getPageIndex(ref[0])
      return pageIndex + 1
    }
  } catch {
    // ignore
  }
  return 1
}

function flattenOutline(items: Array<{ title?: string; dest?: unknown; items?: unknown[] }>): Array<{ title: string; dest: unknown }> {
  const out: Array<{ title: string; dest: unknown }> = []
  for (const item of items) {
    const title = item.title ?? ''
    if (title && item.dest != null) out.push({ title, dest: item.dest })
    if (item.items?.length) out.push(...flattenOutline(item.items as Array<{ title?: string; dest?: unknown; items?: unknown[] }>))
  }
  return out
}

async function loadPdfPageTextsStream(
  url: string,
  onChunk: (pages: Record<number, string>, totalPages: number) => void,
  onOutline?: (chapters: { title: string; page: number }[], totalPages: number) => void
): Promise<void> {
  const arrayBuffer = url.startsWith('blob:')
    ? await fetch(url).then((r) => r.arrayBuffer())
    : await fetch(url).then((r) => r.arrayBuffer())
  const pdfjsLib = await import('pdfjs-dist')
  if (!(pdfjsLib as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions?.workerSrc) {
    (pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs'
  }
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages
  try {
    const outline = await pdf.getOutline()
    if (outline?.length && onOutline) {
      const flat = flattenOutline(outline as Array<{ title?: string; dest?: unknown; items?: unknown[] }>)
      const chapters: { title: string; page: number }[] = []
      for (const item of flat) {
        const page = await getPageIndexFromDest(pdf as Parameters<typeof getPageIndexFromDest>[0], item.dest)
        chapters.push({ title: item.title, page })
      }
      if (chapters.length) onOutline(chapters, totalPages)
    }
  } catch {
    // no outline
  }
  const chunk: Record<number, string> = {}
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((it: unknown) => (typeof it === 'object' && it != null && 'str' in it && typeof (it as { str: string }).str === 'string' ? (it as { str: string }).str : ''))
      .join(' ')
    chunk[i] = text
    if (Object.keys(chunk).length >= PDF_TEXT_CHUNK_SIZE || i === totalPages) {
      onChunk({ ...chunk }, totalPages)
      for (const k of Object.keys(chunk)) delete chunk[Number(k)]
    }
  }
}

export function FileViewer({
  file,
  onPdfTextLoaded,
  onPdfChaptersLoaded,
}: FileViewerProps) {
  const img = isImage(file.type, file.name)
  const vid = isVideo(file.type, file.name)
  const pdf = isPdf(file.type, file.name)
  useEffect(() => {
    if (!pdf || !file.url) return
    let cancelled = false
    loadPdfPageTextsStream(
      file.url,
      (pages, totalPages) => {
        if (!cancelled && onPdfTextLoaded) onPdfTextLoaded(pages, file.id, totalPages)
      },
      (chapters, totalPages) => {
        if (!cancelled && onPdfChaptersLoaded) onPdfChaptersLoaded(chapters, file.id, totalPages)
      }
    )
      .then(() => {})
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pdf, file.id, file.url, onPdfTextLoaded, onPdfChaptersLoaded])

  const isLoading = !file.url || file.url === ''

  return (
    <div className="ide-file-viewer">
      <div className="ide-file-viewer-content">
        {isLoading && (
          <div className="ide-file-viewer-loading">
            <div className="ide-file-viewer-loading-spinner" />
            <span>載入中…</span>
          </div>
        )}
        {!isLoading && img && (
          <img src={file.url} alt={file.name} className="ide-file-viewer-img" />
        )}
        {!isLoading && vid && (
          <video src={file.url} controls className="ide-file-viewer-video" />
        )}
        {!isLoading && pdf && (
          <iframe src={file.url} title={file.name} className="ide-file-viewer-iframe" />
        )}
        {!isLoading && !img && !vid && !pdf && (
          <div className="ide-file-viewer-fallback">
            <p>預覽唔支援呢種檔案類型</p>
            <a href={file.url} download={file.name} className="ide-file-viewer-download">
              下載 {file.name}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
