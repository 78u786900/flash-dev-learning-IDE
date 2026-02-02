import { useMemo, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export type ContentSegment = { type: 'text'; value: string } | { type: 'display'; value: string } | { type: 'inline'; value: string }

/** Block types: LaTeX-first (\section, \begin{itemize}, $$) with markdown fallback (##, -, *) */
type BlockType = 'paragraph' | 'h2' | 'h3' | 'h4' | 'ul' | 'ol' | 'display_math'
interface Block {
  type: BlockType
  content?: string
  items?: string[]
  latex?: string
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

/** Find next \section{, \subsection{, \subsubsection{, \begin{itemize}, \begin{enumerate}, or $$ */
function nextBlockStart(s: string, from: number): { kind: string; index: number; endTag?: string } | null {
  const sectionRe = /\\(section|subsection|subsubsection)\s*\{/g
  sectionRe.lastIndex = from
  let m = sectionRe.exec(s)
  if (m) return { kind: m[1], index: m.index }

  const beginRe = /\\begin\s*\{(\w+)\}/g
  beginRe.lastIndex = from
  m = beginRe.exec(s)
  if (m) return { kind: 'begin', index: m.index, endTag: m[1] }

  const dd = s.indexOf('$$', from)
  if (dd !== -1) return { kind: '$$', index: dd }

  return null
}

/** Split content into blocks: LaTeX \section{}, \begin{itemize}, $$...$$, then markdown ## / - / 1. fallback, then paragraphs */
function parseBlocks(content: string): Block[] {
  if (!content?.trim()) return [{ type: 'paragraph', content: content || '' }]
  const blocks: Block[] = []
  let pos = 0
  const s = content

  while (pos < s.length) {
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

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false })
  } catch {
    return `<span class="katex-error" title="LaTeX error">${escapeHtml(latex)}</span>`
  }
}

function renderInlineSegment(seg: InlineSeg, key: number): ReactNode {
  if (seg.type === 'text') return <span key={key}>{seg.value}</span>
  if (seg.type === 'bold') return <strong key={key} className="ide-note-bold">{renderInlineContent(seg.value)}</strong>
  if (seg.type === 'italic') return <em key={key} className="ide-note-italic">{renderInlineContent(seg.value)}</em>
  if (seg.type === 'code') return <code key={key} className="ide-note-code">{renderInlineContent(seg.value)}</code>
  if (seg.type === 'latex') {
    return (
      <span
        key={key}
        className="ide-latex-inline"
        dangerouslySetInnerHTML={{ __html: renderLatex(seg.value, false) }}
      />
    )
  }
  return <span key={key}>{seg.value}</span>
}

function renderInlineContent(content: string): ReactNode[] {
  const segments = parseInline(content)
  return segments.map((seg, i) => renderInlineSegment(seg, i))
}

interface NoteContentWithLatexProps {
  content: string
  className?: string
}

export function NoteContentWithLatex({ content, className }: NoteContentWithLatexProps) {
  const blocks = useMemo(() => parseBlocks(content), [content])
  return (
    <div className={`ide-note-body ${className ?? ''}`.trim()}>
      {blocks.map((block, i) => {
        if (block.type === 'display_math' && block.latex) {
          return (
            <div
              key={i}
              className="ide-latex-block"
              dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }}
            />
          )
        }
        if ((block.type === 'h2' || block.type === 'h3' || block.type === 'h4') && block.content) {
          const Tag = block.type
          return (
            <Tag key={i} className={`ide-note-${block.type}`}>
              {renderInlineContent(block.content)}
            </Tag>
          )
        }
        if (block.type === 'ul' && block.items?.length) {
          return (
            <ul key={i} className="ide-note-ul">
              {block.items.map((item, j) => (
                <li key={j} className="ide-note-li">
                  {renderInlineContent(item)}
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
                  {renderInlineContent(item)}
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
                ? renderInlineContent(block.content)
                : lines.map((line, j) => (
                    <span key={j}>
                      {j > 0 ? <br /> : null}
                      {renderInlineContent(line)}
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
