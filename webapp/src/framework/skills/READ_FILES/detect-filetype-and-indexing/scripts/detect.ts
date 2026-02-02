/**
 * Detect file type by extension and MIME type
 */
export function detectFileType(filename: string, mimeType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  // By extension (primary)
  const extensionMap: Record<string, string> = {
    'pdf': 'pdf',
    'docx': 'docx', 'doc': 'docx',
    'xlsx': 'xlsx', 'xls': 'xlsx',
    'pptx': 'pptx', 'ppt': 'pptx',
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
    'mp3': 'audio', 'wav': 'audio', 'm4a': 'audio', 'ogg': 'audio',
    'mp4': 'video', 'webm': 'video', 'mov': 'video', 'avi': 'video',
    'js': 'code', 'ts': 'code', 'tsx': 'code', 'jsx': 'code',
    'py': 'code', 'java': 'code', 'cpp': 'code', 'c': 'code', 'go': 'code',
    'txt': 'text', 'md': 'text'
  }
  
  if (ext && extensionMap[ext]) {
    return extensionMap[ext]
  }
  
  // By MIME type (fallback)
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word')) return 'docx'
  if (mimeType.includes('spreadsheet')) return 'xlsx'
  if (mimeType.includes('presentation')) return 'pptx'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('text/')) return 'text'
  
  return 'unknown'
}

/**
 * Chunk text content into smaller pieces
 */
export function chunkTextContent(
  content: string, 
  maxTokens: number = 500
): string[] {
  const chunks: string[] = []
  const paragraphs = content.split(/\n\n+/)
  
  let currentChunk = ''
  let currentTokens = 0
  
  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para)
    
    if (currentTokens + paraTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = para
      currentTokens = paraTokens
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para
      currentTokens += paraTokens
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Extract structure from PDF using pdf.js
 */
export async function extractPdfStructure(pdfBlob: Blob): Promise<any> {
  const pdfjsLib = await import('pdfjs-dist')
  if (!(pdfjsLib as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions?.workerSrc) {
    (pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs'
  }
  const arrayBuffer = await pdfBlob.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
  const structure = {
    type: 'pdf',
    pages: pdf.numPages,
    chapters: [] as Array<{ title: string; page: number }>
  }
  
  // Try to extract outline/TOC
  try {
    const outline = await pdf.getOutline()
    if (outline) {
      for (const item of outline) {
        structure.chapters.push({
          title: item.title,
          page: await getPageNumber(pdf, item.dest)
        })
      }
    }
  } catch (e) {
    console.warn('No outline found in PDF')
  }
  
  return structure
}

async function getPageNumber(pdf: any, dest: any): Promise<number> {
  try {
    const ref = await pdf.getDestination(dest)
    if (ref) {
      const pageIndex = await pdf.getPageIndex(ref[0])
      return pageIndex + 1
    }
  } catch (e) {
    // ignore
  }
  return 1
}

/**
 * Extract structure from DOCX using mammoth
 */
export async function extractDocxStructure(docxBlob: Blob): Promise<any> {
  const mammoth = await import('mammoth')
  
  const arrayBuffer = await docxBlob.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  
  // Extract headings
  const lines = result.value.split('\n')
  const chapters: Array<{ title: string; page: number }> = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.match(/^(Chapter \d+|第\d+章)/i)) {
      chapters.push({ title: line, page: Math.floor(i / 50) + 1 })
    }
  }
  
  return {
    type: 'docx',
    chapters
  }
}

/**
 * Extract structure from XLSX using xlsx
 */
export async function extractXlsxStructure(xlsxBlob: Blob): Promise<any> {
  const XLSX = await import('xlsx')
  
  const arrayBuffer = await xlsxBlob.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  
  return {
    type: 'xlsx',
    sheets: workbook.SheetNames
  }
}

/**
 * Parse code file and extract functions
 */
export function extractCodeStructure(content: string, language: string): any {
  const functions: Array<{ name: string; line: number }> = []
  
  const lines = content.split('\n')
  
  // Simple regex-based extraction (can be improved with proper AST parsing)
  if (language === 'typescript' || language === 'javascript') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(/(?:function|const|let|var)\s+(\w+)\s*\(/) ||
                    line.match(/(\w+)\s*:\s*\([^)]*\)\s*=>/)
      if (match) {
        functions.push({ name: match[1], line: i + 1 })
      }
    }
  } else if (language === 'python') {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^def\s+(\w+)\s*\(/)
      if (match) {
        functions.push({ name: match[1], line: i + 1 })
      }
    }
  }
  
  return {
    type: 'code',
    functions
  }
}
