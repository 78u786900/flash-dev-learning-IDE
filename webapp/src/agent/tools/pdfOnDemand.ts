async function loadPdf(url: string): Promise<{
  numPages: number
  getPage: (n: number) => Promise<any>
}> {
  if (!url?.trim()) throw new Error('PDF URL 為空')
  let arrayBuffer: ArrayBuffer
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch 失敗: ${res.status}`)
    arrayBuffer = await res.arrayBuffer()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`無法讀取 PDF（${msg}）。請喺左邊揀啱要處理嘅 PDF 再試。`)
  }
  const pdfjsLib = await import('pdfjs-dist')
  if (!(pdfjsLib as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions?.workerSrc) {
    ;(pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs'
  }
  try {
    return (await pdfjsLib.getDocument({ data: arrayBuffer }).promise) as {
      numPages: number
      getPage: (n: number) => Promise<any>
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`PDF 解析失敗（${msg}）`)
  }
}

/**
 * Fetch text for a single PDF page on demand. No pre-loading – when a tool needs page N, it calls this.
 * Works with blob: URLs (dropped files) and any fetchable PDF URL.
 * @throws with a short message if fetch or pdfjs fails (caller can show it to user)
 */
export async function getPdfPageTextOnDemand(url: string, pageNumber: number): Promise<string> {
  const pdf = await loadPdf(url)
  const numPages = pdf.numPages
  if (pageNumber < 1 || pageNumber > numPages) return ''
  const page = await pdf.getPage(pageNumber)
  const content = await page.getTextContent()
  const text = content.items
    .map((it: unknown) =>
      typeof it === 'object' && it != null && 'str' in it && typeof (it as { str: string }).str === 'string'
        ? (it as { str: string }).str
        : ''
    )
    .join(' ')
  return text
}

/**
 * Render a single PDF page to PNG data URL so page tools can \"see\" diagrams / non-text regions.
 */
export async function getPdfPageImageOnDemand(url: string, pageNumber: number): Promise<string> {
  const pdf = await loadPdf(url)
  const numPages = pdf.numPages
  if (pageNumber < 1 || pageNumber > numPages) throw new Error('頁碼超出範圍')
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1.5 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('無法建立畫布 context')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: context, viewport }).promise
  return canvas.toDataURL('image/png')
}
