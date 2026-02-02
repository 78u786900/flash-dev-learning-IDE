import { useState, useRef, useEffect } from 'react'
import type { Note, Section } from '../types'
import { NoteContentWithLatex } from './NoteContentWithLatex'

interface CanvasProps {
  note: Note
  onUpdateSection: (sectionId: string, updater: (s: Section) => Section) => void
  onAddSection: () => void
  onSectionDone?: (title: string) => void
}

export function Canvas({ note, onUpdateSection, onAddSection, onSectionDone }: CanvasProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const editRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingSectionId && editRef.current) {
      editRef.current.focus()
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(editRef.current)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [editingSectionId])

  if (!note.sections.length) {
    return (
      <div className="ide-canvas">
        <div className="ide-canvas-empty">
          <div className="cube">◻️</div>
          <p>揀左邊筆記，或者加新 section 開始編輯</p>
          <button type="button" className="ide-add-section" onClick={onAddSection}>
            + 加第一個章節
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ide-canvas">
      {note.sections.map(section => (
        <section key={section.id} className="ide-section">
          <div className="ide-section-header">
            <input
              type="checkbox"
              className="ide-section-check"
              checked={section.done}
              onChange={e => {
              const checked = e.target.checked
              onUpdateSection(section.id, s => ({ ...s, done: checked }))
              if (checked && onSectionDone) onSectionDone(section.title)
            }}
              title="標記完成"
            />
            <input
              type="text"
              value={section.title}
              onChange={e => onUpdateSection(section.id, s => ({ ...s, title: e.target.value }))}
              placeholder="章節標題"
            />
          </div>
          {editingSectionId === section.id ? (
            <div
              ref={editRef}
              className="ide-section-content ide-section-content--edit"
              contentEditable
              data-placeholder="寫內容。數學只支援 LaTeX：行內 $...$、獨立 $$...$$"
              suppressContentEditableWarning
              onBlur={e => {
                const text = e.currentTarget.innerText
                onUpdateSection(section.id, s => (text === s.content ? s : { ...s, content: text }))
                setEditingSectionId(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.currentTarget.innerText = section.content
                  setEditingSectionId(null)
                }
              }}
            >
              {section.content}
            </div>
          ) : (
            <div
              className="ide-section-content ide-section-content--rendered"
              onClick={() => setEditingSectionId(section.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setEditingSectionId(section.id)}
              title="點擊編輯"
            >
              <NoteContentWithLatex content={section.content || ''} />
            </div>
          )}
        </section>
      ))}
      <button type="button" className="ide-add-section" onClick={onAddSection}>
        + 加新章節
      </button>
    </div>
  )
}
