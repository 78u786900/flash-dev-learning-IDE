import type { AgentContext, ToolResult } from '../types'
import type { CallGeminiFn } from './runGemini'

const DEFAULT_MAX = 30
const SNIPPET_LEN = 120

type ScopeKind = 'all' | 'notes' | 'files' | 'note_ids' | 'file_ids'

type Hit =
  | { type: 'note'; noteId: string; noteName: string; index: number; title: string; content: string; score: number }
  | { type: 'file'; fileId: string; fileName: string; fileType: string; score: number }
  | { type: 'pdf_page'; fileId: string; fileName: string; page: number; text: string; score: number }

function parseScope(scope?: string): { kind: ScopeKind; noteIds: string[]; fileIds: string[] } {
  const s = (scope ?? 'all').trim().toLowerCase()
  if (!s || s === 'all') return { kind: 'all', noteIds: [], fileIds: [] }
  if (s === 'notes') return { kind: 'notes', noteIds: [], fileIds: [] }
  if (s === 'files') return { kind: 'files', noteIds: [], fileIds: [] }
  if (s.startsWith('note_ids:')) {
    const ids = s.slice(9).split(',').map(x => x.trim()).filter(Boolean)
    return { kind: 'note_ids', noteIds: ids, fileIds: [] }
  }
  if (s.startsWith('file_ids:')) {
    const ids = s.slice(9).split(',').map(x => x.trim()).filter(Boolean)
    return { kind: 'file_ids', noteIds: [], fileIds: ids }
  }
  return { kind: 'all', noteIds: [], fileIds: [] }
}

function snippet(text: string, maxLen: number = SNIPPET_LEN): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen) + '…'
}

type Chunk = { hit: Hit; text: string }

function buildChunks(ctx: AgentContext, kind: ScopeKind, noteIds: string[], fileIds: string[]): Chunk[] {
  const chunks: Chunk[] = []
  const searchNotes = kind === 'all' || kind === 'notes' || kind === 'note_ids'
  if (searchNotes && ctx.notes?.length) {
    const notesToSearch = kind === 'note_ids' && noteIds.length ? ctx.notes.filter(n => noteIds.includes(n.id)) : ctx.notes
    for (const note of notesToSearch) {
      for (let i = 0; i < note.sections.length; i++) {
        const s = note.sections[i]
        const title = s?.title ?? ''
        const content = s?.content ?? ''
        const text = `${title}\n${content}`.trim() || '(empty)'
        chunks.push({
          hit: { type: 'note', noteId: note.id, noteName: note.name, index: i + 1, title, content, score: 0 },
          text,
        })
      }
    }
  }
  const searchFiles = kind === 'all' || kind === 'files' || kind === 'file_ids'
  if (searchFiles && ctx.files?.length) {
    const filesToSearch = kind === 'file_ids' && fileIds.length ? ctx.files.filter(f => fileIds.includes(f.id)) : ctx.files
    for (const file of filesToSearch) {
      const text = `${file.name} ${file.type}`.trim()
      chunks.push({ hit: { type: 'file', fileId: file.id, fileName: file.name, fileType: file.type, score: 0 }, text })
    }
  }
  if (searchFiles && ctx.pdfPageTexts && ctx.file?.name?.toLowerCase().endsWith('.pdf')) {
    const fileInScope = kind === 'file_ids' && fileIds.length ? fileIds.includes(ctx.file.id) : true
    if (fileInScope) {
      for (const [pageStr, text] of Object.entries(ctx.pdfPageTexts)) {
        const page = parseInt(pageStr, 10)
        if (Number.isNaN(page) || !text) continue
        chunks.push({
          hit: { type: 'pdf_page', fileId: ctx.file.id, fileName: ctx.file.name, page, text, score: 0 },
          text,
        })
      }
    }
  }
  return chunks
}

/** search_workspace: keyword or semantic search over workspace; output most relevant hits with position and source */
export async function run_search_workspace(
  params: { query?: string; scope?: string; max_results?: string; mode?: string },
  ctx: AgentContext,
  _callGemini: CallGeminiFn
): Promise<ToolResult> {
  const query = (params.query ?? '').trim()
  if (!query) return { success: false, error: '請提供搜尋關鍵字 query。' }
  const mode = (params.mode ?? 'keyword').trim().toLowerCase()
  const useSemantic = mode === 'semantic' && typeof ctx.embedForSearch === 'function'
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)
  const maxResults = Math.min(100, Math.max(5, parseInt(params.max_results ?? String(DEFAULT_MAX), 10) || DEFAULT_MAX))
  const { kind, noteIds, fileIds } = parseScope(params.scope)

  let allHits: Hit[] = []

  if (useSemantic) {
    const chunks = buildChunks(ctx, kind, noteIds, fileIds)
    if (chunks.length === 0) {
      return { success: true, text: `Query: "${query}". No content in scope to search (semantic). Add notes or open a PDF.` }
    }
    try {
      const documents = chunks.map(c => c.text)
      const scores = await ctx.embedForSearch!(query, documents)
      allHits = chunks.map((c, i) => ({ ...c.hit, score: scores[i] ?? 0 })).filter(h => h.score > 0.15)
      allHits.sort((a, b) => b.score - a.score)
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      return { success: false, error: `語意搜尋失敗：${err}。可試 mode=keyword。` }
    }
  } else {
    // —— Keyword path (unchanged) ——
    if (kind === 'all' || kind === 'notes' || kind === 'note_ids') {
      if (ctx.notes?.length) {
        const notesToSearch = kind === 'note_ids' && noteIds.length ? ctx.notes.filter(n => noteIds.includes(n.id)) : ctx.notes
        for (const note of notesToSearch) {
          for (let i = 0; i < note.sections.length; i++) {
            const s = note.sections[i]
            const title = (s?.title ?? '').toLowerCase()
            const content = (s?.content ?? '').toLowerCase()
            const score = keywords.reduce((n, k) => n + (title.includes(k) ? 2 : 0) + (content.includes(k) ? 1 : 0), 0)
            if (score > 0) allHits.push({ type: 'note', noteId: note.id, noteName: note.name, index: i + 1, title: s?.title ?? '', content: s?.content ?? '', score })
          }
        }
      }
    }
    if (kind === 'all' || kind === 'files' || kind === 'file_ids') {
      if (ctx.files?.length) {
        const filesToSearch = kind === 'file_ids' && fileIds.length ? ctx.files.filter(f => fileIds.includes(f.id)) : ctx.files
        for (const file of filesToSearch) {
          const name = (file.name ?? '').toLowerCase()
          const type = (file.type ?? '').toLowerCase()
          const score = keywords.reduce((n, k) => n + (name.includes(k) ? 2 : 0) + (type.includes(k) ? 1 : 0), 0)
          if (score > 0) allHits.push({ type: 'file', fileId: file.id, fileName: file.name, fileType: file.type, score })
        }
      }
    }
    if (kind === 'all' || kind === 'files' || kind === 'file_ids') {
      if (ctx.pdfPageTexts && ctx.file?.name?.toLowerCase().endsWith('.pdf')) {
        const fileInScope = kind === 'file_ids' && fileIds.length ? fileIds.includes(ctx.file.id) : true
        if (fileInScope) {
          for (const [pageStr, text] of Object.entries(ctx.pdfPageTexts)) {
            const page = parseInt(pageStr, 10)
            if (Number.isNaN(page) || !text) continue
            const lower = text.toLowerCase()
            const score = keywords.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0)
            if (score > 0) allHits.push({ type: 'pdf_page', fileId: ctx.file.id, fileName: ctx.file.name, page, text, score })
          }
        }
      }
    }
    allHits.sort((a, b) => b.score - a.score)
  }

  const top = allHits.slice(0, maxResults)
  const searchKind = useSemantic ? 'semantic (語意)' : 'keyword (關鍵字)'

  const lines: string[] = [
    `Query: "${query}"`,
    `Search: ${searchKind} over workspace (note sections, PDF page text, file names). Results: most relevant first.`,
    ''
  ]
  top.forEach((h, i) => {
    if (h.type === 'note') {
      lines.push(`[${i + 1}] source: note "${h.noteName}" (note_id: ${h.noteId}) | position: section §${h.index} "${h.title}" | snippet: ${snippet(h.content)}`)
    } else if (h.type === 'file') {
      lines.push(`[${i + 1}] source: file "${h.fileName}" (file_id: ${h.fileId}) | position: file | snippet: ${h.fileName} (${h.fileType})`)
    } else {
      lines.push(`[${i + 1}] source: file "${h.fileName}" (file_id: ${h.fileId}) | position: page ${h.page} | snippet: ${snippet(h.text)}`)
    }
  })

  if (top.length === 0) {
    return { success: true, text: `Query: "${query}". No matches in workspace (${searchKind}). Try different keywords, broaden scope, or use mode=semantic for 語意搜尋.` }
  }
  lines.push('')
  lines.push(`Total: ${top.length} hit(s). Use source (note_id / file_id) and position (section §N / page N) for next-step tools (update_section, page_to_note, summarize_page).`)
  return { success: true, text: lines.join('\n') }
}
