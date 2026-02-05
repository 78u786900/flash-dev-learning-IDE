import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { encode } from 'plantuml-encoder'

export type ContentSegment = { type: 'text'; value: string } | { type: 'display'; value: string } | { type: 'inline'; value: string }

/** Render error info for auto-fix */
export interface RenderErrorInfo {
  type: 'latex' | 'plantuml'
  content: string
  errorMessage: string
}

/** PlantUML server: in dev use Vite proxy (same-origin); in prod use public server. PNG endpoint is most reliable. */
const PLANTUML_IMG_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/plantuml/img/'  // Vite proxy forwards to https://www.plantuml.com/plantuml/img/
    : 'https://www.plantuml.com/plantuml/img/'

/** Block types: LaTeX-first (\section, \begin{itemize}, $$), PlantUML (@startuml...@enduml), markdown fallback */
type BlockType = 'paragraph' | 'h2' | 'h3' | 'h4' | 'ul' | 'ol' | 'display_math' | 'plantuml'
interface Block {
  type: BlockType
  content?: string
  items?: string[]
  latex?: string
  /** Raw PlantUML source (including @startuml / @enduml) for encoding */
  plantuml?: string
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

/** Return content and end index of balanced {...} starting at openIndex (s[openIndex] === '{') */
function findBalancedBraces(s: string, openIndex: number): { content: string; endIndex: number } | null {
  if (s[openIndex] !== '{') return null
  let depth = 1
  let i = openIndex + 1
  while (i < s.length && depth > 0) {
    if (s[i] === '\\' && s[i + 1] === '{') {
      i += 2
      continue
    }
    if (s[i] === '{') depth++
    else if (s[i] === '}') depth--
    i++
  }
  if (depth !== 0) return null
  return { content: s.slice(openIndex + 1, i - 1), endIndex: i - 1 }
}

/** Find next \section{, \subsection{, \subsubsection{, \[, \begin{itemize}, \begin{enumerate}, or $$ */
function nextBlockStart(s: string, from: number): { kind: string; index: number; endTag?: string } | null {
  // Collect all potential matches and return the EARLIEST one
  const candidates: { kind: string; index: number; endTag?: string }[] = []

  // Check for \section, \subsection, \subsubsection
  const sectionRe = /\\(section|subsection|subsubsection)\s*\{/g
  sectionRe.lastIndex = from
  const sectionMatch = sectionRe.exec(s)
  if (sectionMatch) {
    candidates.push({ kind: sectionMatch[1], index: sectionMatch.index })
  }

  // Check for \[
  const bracketOpen = s.indexOf('\\[', from)
  if (bracketOpen !== -1) {
    candidates.push({ kind: 'display_bracket', index: bracketOpen })
  }

  // Check for \begin{...}
  const beginRe = /\\begin\s*\{(\w+)\}/g
  beginRe.lastIndex = from
  const beginMatch = beginRe.exec(s)
  if (beginMatch) {
    candidates.push({ kind: 'begin', index: beginMatch.index, endTag: beginMatch[1] })
  }

  // Check for $$
  const dd = s.indexOf('$$', from)
  if (dd !== -1) {
    candidates.push({ kind: '$$', index: dd })
  }

  // Return the earliest match
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.index - b.index)
  return candidates[0]
}

/** Find next PlantUML block (@startuml...@enduml or @startmindmap...@endmindmap etc.) from fromIndex. Returns { start, end, source } or null. */
function findPlantUmlBlock(s: string, fromIndex: number): { start: number; end: number; source: string } | null {
  const startRe = /@start(\w+)/g
  startRe.lastIndex = fromIndex
  const m = startRe.exec(s)
  if (!m) return null
  const tag = m[1]
  const start = m.index
  const endTag = '@end' + tag
  const endIdx = s.indexOf(endTag, start)
  if (endIdx === -1) return null
  const end = endIdx + endTag.length
  const source = s.slice(start, end).trim()
  return { start, end, source }
}

/** Split content into blocks: PlantUML (@startuml...@enduml), LaTeX \section{}, \begin{itemize}, $$...$$, markdown fallback, paragraphs */
function parseBlocks(content: string): Block[] {
  if (!content?.trim()) return [{ type: 'paragraph', content: content || '' }]
  const blocks: Block[] = []
  let pos = 0
  const s = content

  while (pos < s.length) {
    const plantumlBlock = findPlantUmlBlock(s, pos)
    if (plantumlBlock) {
      if (plantumlBlock.start > pos) {
        const para = s.slice(pos, plantumlBlock.start).trim()
        if (para) blocks.push({ type: 'paragraph', content: para })
      }
      blocks.push({ type: 'plantuml', plantuml: plantumlBlock.source })
      pos = plantumlBlock.end
      continue
    }

    const next = nextBlockStart(s, pos)
    if (next) {
      if (next.kind === 'section' || next.kind === 'subsection' || next.kind === 'subsubsection') {
        const openBrace = s.indexOf('{', next.index)
        const balanced = openBrace >= 0 ? findBalancedBraces(s, openBrace) : null
        if (balanced) {
          if (next.index > pos) {
            const para = s.slice(pos, next.index).trim()
            if (para) blocks.push({ type: 'paragraph', content: para })
          }
          const blockType = next.kind === 'section' ? 'h2' : next.kind === 'subsection' ? 'h3' : 'h4'
          blocks.push({ type: blockType, content: balanced.content })
          pos = balanced.endIndex + 1
          continue
        }
      }
      if (next.kind === 'begin' && next.endTag && (next.endTag === 'itemize' || next.endTag === 'enumerate')) {
        const endTag = `\\end{${next.endTag}}`
        const endIdx = s.indexOf(endTag, next.index)
        const beginCloser = s.indexOf('}', next.index)
        if (endIdx !== -1 && beginCloser > next.index) {
          if (next.index > pos) {
            const para = s.slice(pos, next.index).trim()
            if (para) blocks.push({ type: 'paragraph', content: para })
          }
          const body = s.slice(beginCloser + 1, endIdx).trim() // after \begin{...}
          const items = body.split(/\s*\\item\s*/).map(x => x.trim()).filter(Boolean)
          blocks.push({ type: next.endTag === 'enumerate' ? 'ol' : 'ul', items })
          pos = endIdx + endTag.length
          continue
        }
      }
      if (next.kind === 'begin' && (next.endTag === 'CD' || next.endTag === 'array')) {
        const endTag = `\\end{${next.endTag}}`
        const endIdx = s.indexOf(endTag, next.index)
        if (endIdx !== -1) {
          if (next.index > pos) {
            const para = s.slice(pos, next.index).trim()
            if (para) blocks.push({ type: 'paragraph', content: para })
          }
          const fullBlock = s.slice(next.index, endIdx + endTag.length)
          blocks.push({ type: 'display_math', latex: fullBlock })
          pos = endIdx + endTag.length
          continue
        }
      }
      if (next.kind === 'display_bracket') {
        let searchStart = next.index + 2
        let endIdx = s.indexOf('\\]', searchStart)
        while (endIdx !== -1 && endIdx > 0 && s[endIdx - 1] === '\\') {
          searchStart = endIdx + 2
          endIdx = s.indexOf('\\]', searchStart)
        }
        if (endIdx !== -1) {
          if (next.index > pos) {
            const para = s.slice(pos, next.index).trim()
            if (para) blocks.push({ type: 'paragraph', content: para })
          }
          blocks.push({ type: 'display_math', latex: s.slice(next.index + 2, endIdx).trim() })
          pos = endIdx + 2
          continue
        }
      }
      if (next.kind === '$$') {
        const endDd = s.indexOf('$$', next.index + 2)
        if (endDd !== -1) {
          if (next.index > pos) {
            const para = s.slice(pos, next.index).trim()
            if (para) blocks.push({ type: 'paragraph', content: para })
          }
          blocks.push({ type: 'display_math', latex: s.slice(next.index + 2, endDd).trim() })
          pos = endDd + 2
          continue
        }
      }
    }

    const displayRe = /\$\$([\s\S]*?)\$\$/g
    displayRe.lastIndex = pos
    const dm = displayRe.exec(s)
    if (dm && dm.index === pos) {
      blocks.push({ type: 'display_math', latex: dm[1].trim() })
      pos = displayRe.lastIndex
      continue
    }

    const nextDouble = s.indexOf('\n\n', pos)
    const endPos = nextDouble >= 0 ? nextDouble + 2 : s.length
    const chunkTrim = s.slice(pos, endPos).trim()
    pos = endPos
    if (!chunkTrim) continue

    const lines = chunkTrim.split('\n')
    const first = lines[0] ?? ''
    if (first.startsWith('### ')) {
      blocks.push({ type: 'h4', content: first.slice(4).trim() })
      if (lines.length > 1) blocks.push({ type: 'paragraph', content: lines.slice(1).join('\n') })
    } else if (first.startsWith('## ')) {
      blocks.push({ type: 'h3', content: first.slice(3).trim() })
      if (lines.length > 1) blocks.push({ type: 'paragraph', content: lines.slice(1).join('\n') })
    } else if (first.startsWith('# ')) {
      blocks.push({ type: 'h2', content: first.slice(2).trim() })
      if (lines.length > 1) blocks.push({ type: 'paragraph', content: lines.slice(1).join('\n') })
    } else if (lines.length >= 1 && lines.every(l => /^[-*]\s/.test(l) || /^\d+\.\s/.test(l))) {
      const listType = /^\d+\.\s/.test(first) ? 'ol' : 'ul'
      const items = lines.map(l => l.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '').trim())
      blocks.push({ type: listType, items })
    } else {
      blocks.push({ type: 'paragraph', content: chunkTrim })
    }
  }

  return blocks.length ? blocks : [{ type: 'paragraph', content }]
}

/** Inline segment: text | bold | italic | code | latex (LaTeX \textbf, \textit, \texttt, $...$ and markdown **, *, ` fallback) */
type InlineSeg = { type: 'text' | 'bold' | 'italic' | 'code' | 'latex'; value: string }

/** Consume unknown \command or \command{...} and return the raw string and end index (so we can show as plain text). */
function consumeUnknownCommand(s: string, backslashIndex: number): { raw: string; endIndex: number } {
  let i = backslashIndex + 1
  while (i < s.length && /[a-zA-Z]/.test(s[i])) i++
  if (i < s.length && s[i] === '{') {
    const balanced = findBalancedBraces(s, i)
    if (balanced) return { raw: s.slice(backslashIndex, balanced.endIndex + 1), endIndex: balanced.endIndex }
  }
  return { raw: s.slice(backslashIndex, i), endIndex: i - 1 }
}

/** Parse inline: LaTeX $...$, \textbf{...}, \textit{...}, \texttt{...}, then markdown **, *, ` */
function parseInline(text: string): InlineSeg[] {
  if (!text) return []
  const segments: InlineSeg[] = []
  let idx = 0

  while (idx < text.length) {
    const dollar = text.indexOf('$', idx)
    const backslash = text.indexOf('\\', idx)
    const nextDollar = dollar >= 0 ? dollar : text.length
    const nextBackslash = backslash >= 0 ? backslash : text.length

    if (nextBackslash < nextDollar) {
      const cmdMatch = text.slice(nextBackslash).match(/^\\(textbf|textit|texttt)\s*\{/)
      if (cmdMatch) {
        const openBrace = nextBackslash + cmdMatch[0].length - 1
        if (nextBackslash > idx) segments.push({ type: 'text', value: text.slice(idx, nextBackslash) })
        const balanced = findBalancedBraces(text, openBrace)
        if (balanced) {
          const cmd = cmdMatch[1]
          const segType = cmd === 'textbf' ? 'bold' : cmd === 'textit' ? 'italic' : 'code'
          segments.push({ type: segType, value: balanced.content })
          idx = balanced.endIndex + 1
          continue
        }
      }
      // Unknown \command (e.g. \tovthfs): show as plain text so rendering doesn't break
      if (nextBackslash > idx) segments.push({ type: 'text', value: text.slice(idx, nextBackslash) })
      const { raw, endIndex } = consumeUnknownCommand(text, nextBackslash)
      segments.push({ type: 'text', value: raw })
      idx = endIndex + 1
      continue
    }

    if (nextDollar < text.length) {
      const after = text.indexOf('$', nextDollar + 1)
      if (after !== -1 && after > nextDollar) {
        if (nextDollar > idx) segments.push({ type: 'text', value: text.slice(idx, nextDollar) })
        segments.push({ type: 'latex', value: text.slice(nextDollar + 1, after).trim() })
        idx = after + 1
        continue
      }
    }

    if (nextDollar === text.length && nextBackslash === text.length) {
      segments.push({ type: 'text', value: text.slice(idx) })
      break
    }
    segments.push({ type: 'text', value: text.slice(idx, Math.min(nextDollar, nextBackslash)) })
    idx = Math.min(nextDollar, nextBackslash)
  }

  const expand = (segs: InlineSeg[]): InlineSeg[] => {
    const out: InlineSeg[] = []
    for (const s of segs) {
      if (s.type !== 'text') {
        out.push(s)
        continue
      }
      const boldRe = /\*\*(.+?)\*\*/g
      const italicRe = /\*([^*]+?)\*/g
      const codeRe = /`([^`]+?)`/g
      let pos = 0
      const matches: { index: number; end: number; type: 'bold' | 'italic' | 'code'; value: string }[] = []
      let b: RegExpExecArray | null
      while ((b = boldRe.exec(s.value)) !== null) matches.push({ index: b.index, end: boldRe.lastIndex, type: 'bold', value: b[1] })
      italicRe.lastIndex = 0
      while ((b = italicRe.exec(s.value)) !== null) matches.push({ index: b.index, end: italicRe.lastIndex, type: 'italic', value: b[1] })
      codeRe.lastIndex = 0
      while ((b = codeRe.exec(s.value)) !== null) matches.push({ index: b.index, end: codeRe.lastIndex, type: 'code', value: b[1] })
      matches.sort((a, b) => a.index - b.index)
      for (const m of matches) {
        if (m.index < pos) continue
        if (m.index > pos) out.push({ type: 'text', value: s.value.slice(pos, m.index) })
        out.push({ type: m.type, value: m.value })
        pos = m.end
      }
      if (pos < s.value.length) out.push({ type: 'text', value: s.value.slice(pos) })
      else if (out.length === 0) out.push(s)
    }
    return out.length ? out : segs
  }
  return expand(segments)
}

/** Render LaTeX; returns { html, error? } */
function renderLatex(latex: string, displayMode: boolean): { html: string; error?: string } {
  try {
    // Try with throwOnError: true first to detect parse errors
    const html = katex.renderToString(latex, { displayMode, throwOnError: true })
    return { html }
  } catch (e) {
    // KaTeX threw an error - try again with throwOnError: false for partial rendering
    const errorMsg = e instanceof Error ? e.message : 'Unknown LaTeX error'
    try {
      const html = katex.renderToString(latex, { displayMode, throwOnError: false })
      // If it still produces output, return it with the error
      if (html && !html.includes('katex-error')) {
        return { html, error: errorMsg }
      }
    } catch {
      // Fallback failed too
    }
    return {
      html: `<span class="katex-error" title="${escapeHtml(errorMsg)}">${escapeHtml(latex)}</span>`,
      error: errorMsg,
    }
  }
}

/** Normalize PlantUML source so encoding and server accept it (line endings, trim). */
function normalizePlantUmlSource(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

/** Encode PlantUML source for server URL; returns null on error. */
function encodePlantUmlUrl(source: string): string | null {
  try {
    const normalized = normalizePlantUmlSource(source)
    if (!normalized) return null
    const encoded = encode(normalized)
    if (!encoded) return null
    return PLANTUML_IMG_BASE + encoded
  } catch {
    return null
  }
}

/** Renders a PlantUML diagram with fallback on load error (e.g. server unreachable or invalid diagram). */
function PlantUmlBlock({
  source,
  className,
  onError,
}: {
  source: string
  className?: string
  onError?: (err: RenderErrorInfo) => void
}) {
  const [loadError, setLoadError] = useState(false)
  const url = useMemo(() => encodePlantUmlUrl(source), [source])
  const errorReported = useRef(false)

  // Report encoding error if URL generation failed
  useEffect(() => {
    if (!url && !errorReported.current) {
      errorReported.current = true
      onError?.({
        type: 'plantuml',
        content: source,
        errorMessage: 'Failed to encode PlantUML source - check syntax',
      })
    }
  }, [url, source, onError])

  if (!url) {
    return <pre className={`ide-plantuml-fallback ${className ?? ''}`.trim()}>{source}</pre>
  }
  if (loadError) {
    return (
      <div className={className}>
        <p className="ide-plantuml-error">Diagram could not be loaded (check syntax or network).</p>
        <pre className="ide-plantuml-fallback">{source}</pre>
      </div>
    )
  }
  return (
    <figure className="ide-plantuml-figure">
      <img
        src={url}
        alt="PlantUML diagram"
        className="ide-plantuml-img"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setLoadError(true)
          if (!errorReported.current) {
            errorReported.current = true
            onError?.({
              type: 'plantuml',
              content: source,
              errorMessage: 'PlantUML server returned error - diagram syntax may be invalid',
            })
          }
        }}
      />
      <figcaption className="ide-plantuml-caption">
        Rendered by plantuml.com (banner/QR in image is from their server).
      </figcaption>
    </figure>
  )
}

function renderInlineSegment(
  seg: InlineSeg,
  key: number,
  onError?: (err: RenderErrorInfo) => void
): ReactNode {
  if (seg.type === 'text') return <span key={key}>{seg.value}</span>
  if (seg.type === 'bold') return <strong key={key} className="ide-note-bold">{renderInlineContentWithErrors(seg.value, onError)}</strong>
  if (seg.type === 'italic') return <em key={key} className="ide-note-italic">{renderInlineContentWithErrors(seg.value, onError)}</em>
  if (seg.type === 'code') return <code key={key} className="ide-note-code">{renderInlineContentWithErrors(seg.value, onError)}</code>
  if (seg.type === 'latex') {
    const { html, error } = renderLatex(seg.value, false)
    if (error) {
      onError?.({ type: 'latex', content: seg.value, errorMessage: error })
    }
    return (
      <span
        key={key}
        className="ide-latex-inline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return <span key={key}>{seg.value}</span>
}

function renderInlineContent(content: string): ReactNode[] {
  const segments = parseInline(content)
  return segments.map((seg, i) => renderInlineSegment(seg, i))
}

function renderInlineContentWithErrors(
  content: string,
  onError?: (err: RenderErrorInfo) => void
): ReactNode[] {
  const segments = parseInline(content)
  return segments.map((seg, i) => renderInlineSegment(seg, i, onError))
}

interface NoteContentWithLatexProps {
  content: string
  className?: string
  /** Callback for render errors (LaTeX/PlantUML) */
  onRenderError?: (err: RenderErrorInfo) => void
}

export function NoteContentWithLatex({ content, className, onRenderError }: NoteContentWithLatexProps) {
  const blocks = useMemo(() => parseBlocks(content), [content])
  const reportedErrors = useRef<Set<string>>(new Set())

  // Helper to report error only once per unique content
  const reportError = (err: RenderErrorInfo) => {
    const key = `${err.type}:${err.content.slice(0, 100)}`
    if (!reportedErrors.current.has(key)) {
      reportedErrors.current.add(key)
      onRenderError?.(err)
    }
  }

  // Reset reported errors when content changes
  useEffect(() => {
    reportedErrors.current.clear()
  }, [content])

  return (
    <div className={`ide-note-body ${className ?? ''}`.trim()}>
      {blocks.map((block, i) => {
        if (block.type === 'plantuml' && block.plantuml) {
          return (
            <div key={i} className="ide-plantuml-block">
              <PlantUmlBlock source={block.plantuml} onError={reportError} />
            </div>
          )
        }
        if (block.type === 'display_math' && block.latex) {
          const { html, error } = renderLatex(block.latex, true)
          if (error) {
            reportError({ type: 'latex', content: block.latex, errorMessage: error })
          }
          return (
            <div
              key={i}
              className="ide-latex-block"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
        if ((block.type === 'h2' || block.type === 'h3' || block.type === 'h4') && block.content) {
          const Tag = block.type
          return (
            <Tag key={i} className={`ide-note-${block.type}`}>
              {renderInlineContentWithErrors(block.content, reportError)}
            </Tag>
          )
        }
        if (block.type === 'ul' && block.items?.length) {
          return (
            <ul key={i} className="ide-note-ul">
              {block.items.map((item, j) => (
                <li key={j} className="ide-note-li">
                  {renderInlineContentWithErrors(item, reportError)}
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol' && block.items?.length) {
          return (
            <ol key={i} className="ide-note-ol">
              {block.items.map((item, j) => (
                <li key={j} className="ide-note-li">
                  {renderInlineContentWithErrors(item, reportError)}
                </li>
              ))}
            </ol>
          )
        }
        if (block.type === 'paragraph' && block.content != null) {
          const lines = block.content.split('\n')
          return (
            <p key={i} className="ide-note-p">
              {lines.length === 1
                ? renderInlineContentWithErrors(block.content, reportError)
                : lines.map((line, j) => (
                    <span key={j}>
                      {j > 0 ? <br /> : null}
                      {renderInlineContentWithErrors(line, reportError)}
                    </span>
                  ))}
            </p>
          )
        }
        return null
      })}
    </div>
  )
}
