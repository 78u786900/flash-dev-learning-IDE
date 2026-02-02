import { useState, useCallback, useRef, useEffect } from 'react'
import type { Note, DroppedFile, TimelineAction } from '../types'

interface SidebarProps {
  notes: Note[]
  files: DroppedFile[]
  activeNoteId: string | null
  activeFileId: string | null
  timeline: TimelineAction[]
  onSelectNote: (id: string) => void
  onSelectFile: (id: string) => void
  onAddNote: (name: string) => void
  onDropFiles: (files: File[]) => void
  onRenameFile?: (id: string, newName: string) => void
  onDeleteFile?: (id: string) => void
}

const FILE_ICONS: Record<string, string> = {
  pdf: '📕',
  doc: '📘',
  docx: '📘',
  ppt: '📙',
  pptx: '📙',
  xls: '📗',
  xlsx: '📗',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  webp: '🖼️',
  mp4: '🎬',
  webm: '🎬',
  default: '📎',
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return FILE_ICONS[ext] ?? FILE_ICONS.default
}

export function Sidebar({
  notes,
  files,
  activeNoteId,
  activeFileId,
  timeline,
  onSelectNote,
  onSelectFile,
  onAddNote,
  onDropFiles,
  onRenameFile,
  onDeleteFile,
}: SidebarProps) {
  const [newNoteName, setNewNoteName] = useState('')
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingFileId) {
      setEditingName(files.find(f => f.id === editingFileId)?.name ?? '')
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [editingFileId, files])

  const handleRenameSubmit = useCallback(() => {
    if (editingFileId && onRenameFile && editingName.trim()) {
      onRenameFile(editingFileId, editingName.trim())
      setEditingFileId(null)
      setEditingName('')
    } else {
      setEditingFileId(null)
      setEditingName('')
    }
  }, [editingFileId, editingName, onRenameFile])

  const handleAddNote = () => {
    if (newNoteName.trim()) {
      onAddNote(newNoteName.trim())
      setNewNoteName('')
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) onDropFiles(dropped)
  }, [onDropFiles])

  const formatTime = (at: number) => {
    const d = new Date(at)
    const now = new Date()
    const diff = now.getTime() - at
    if (diff < 60000) return '剛剛'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`
    return d.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <aside className="ide-sidebar">
      <div className="ide-sidebar-section">
        <div className="ide-sidebar-section-title">LEARNING_IDE</div>
        <div
          className={`ide-sidebar-dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="ide-sidebar-dropzone-text">拖放檔案到呢度</span>
          <span className="ide-sidebar-dropzone-hint">docx, pptx, pdf, excel, 圖, 片…</span>
        </div>
        {notes.map(note => (
          <div
            key={note.id}
            className={`ide-sidebar-item ${activeNoteId === note.id && !activeFileId ? 'active' : ''}`}
            onClick={() => onSelectNote(note.id)}
          >
            <span className="icon">📄</span>
            <span>{note.name}</span>
          </div>
        ))}
        {files.map(file => (
          <div
            key={file.id}
            className={`ide-sidebar-item ide-sidebar-item-file ${activeFileId === file.id ? 'active' : ''}`}
            onClick={() => editingFileId !== file.id && onSelectFile(file.id)}
          >
            <span className="icon">{fileIcon(file.name)}</span>
            {editingFileId === file.id ? (
              <input
                ref={renameInputRef}
                type="text"
                className="ide-sidebar-file-rename-input"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') {
                    setEditingFileId(null)
                    setEditingName('')
                  }
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="ide-sidebar-item-name" title={file.name}>{file.name}</span>
                {(onRenameFile || onDeleteFile) && (
                  <span className="ide-sidebar-file-actions" onClick={e => e.stopPropagation()}>
                    {onRenameFile && (
                      <button
                        type="button"
                        className="ide-sidebar-file-action"
                        title="重新命名"
                        aria-label="重新命名"
                        onClick={() => setEditingFileId(file.id)}
                      >
                        ✎
                      </button>
                    )}
                    {onDeleteFile && (
                      <button
                        type="button"
                        className="ide-sidebar-file-action ide-sidebar-file-action-delete"
                        title="刪除檔案"
                        aria-label="刪除檔案"
                        onClick={() => onDeleteFile(file.id)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="ide-sidebar-add">
        <input
          type="text"
          placeholder="+ 新筆記名稱..."
          value={newNoteName}
          onChange={e => setNewNoteName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddNote()}
        />
      </div>
      <div
        className="ide-sidebar-collapse"
        onClick={() => setOutlineOpen(!outlineOpen)}
      >
        {outlineOpen ? '▼' : '▶'} OUTLINE
      </div>
      {outlineOpen && (
        <div className="ide-sidebar-section">
          {notes.find(n => n.id === activeNoteId)?.sections.map((s, i) => (
            <div
              key={s.id}
              className="ide-sidebar-item"
              style={{ paddingLeft: 20, fontSize: 12 }}
            >
              § {i + 1}. {s.title}
            </div>
          ))}
          {!activeNoteId && activeFileId && (
            <div className="ide-sidebar-item" style={{ paddingLeft: 20, fontSize: 12, color: 'var(--text-dim)' }}>
              已揀選檔案
            </div>
          )}
        </div>
      )}
      <div
        className="ide-sidebar-collapse"
        onClick={() => setTimelineOpen(!timelineOpen)}
      >
        {timelineOpen ? '▼' : '▶'} TIMELINE
      </div>
      {timelineOpen && (
        <div className="ide-sidebar-section ide-timeline-list">
          {timeline.length === 0 ? (
            <div className="ide-timeline-empty">暫無操作記錄</div>
          ) : (
            timeline.slice().reverse().map(action => (
              <div key={action.id} className="ide-timeline-item">
                <span className="ide-timeline-label">{action.label}</span>
                <span className="ide-timeline-time">{formatTime(action.at)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  )
}
