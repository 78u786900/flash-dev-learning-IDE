import { useState, useCallback, useRef, useEffect } from 'react'
import type { Note, DroppedFile, TimelineAction } from '../types'

interface UploadingFile {
  id: string
  name: string
  size: number
  progress: number
}

interface SidebarProps {
  notes: Note[]
  files: DroppedFile[]
  uploadingFiles?: UploadingFile[]
  activeNoteId: string | null
  activeFileId: string | null
  timeline: TimelineAction[]
  onSelectNote: (id: string) => void
  onSelectFile: (id: string) => void
  onAddNote: (name: string) => void
  onDropFiles: (files: File[]) => void
  onRenameFile?: (id: string, newName: string) => void
  onDeleteFile?: (id: string) => void
  /** Deprecated: keep in type for compatibility, but not used in UI. */
  onRequestDeleteNote?: (noteId: string) => void
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

type FileGroupId = 'pdf' | 'doc' | 'slides' | 'sheets' | 'images' | 'videos' | 'other'

interface FileGroup {
  id: FileGroupId
  label: string
  files: DroppedFile[]
}

function groupFiles(files: DroppedFile[]): FileGroup[] {
  const groups: Record<FileGroupId, DroppedFile[]> = {
    pdf: [],
    doc: [],
    slides: [],
    sheets: [],
    images: [],
    videos: [],
    other: [],
  }

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'pdf') groups.pdf.push(file)
    else if (ext === 'doc' || ext === 'docx') groups.doc.push(file)
    else if (ext === 'ppt' || ext === 'pptx') groups.slides.push(file)
    else if (ext === 'xls' || ext === 'xlsx') groups.sheets.push(file)
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) groups.images.push(file)
    else if (['mp4', 'webm'].includes(ext)) groups.videos.push(file)
    else groups.other.push(file)
  }

  const order: { id: FileGroupId; label: string }[] = [
    { id: 'pdf', label: 'PDF' },
    { id: 'doc', label: 'Word / Docs' },
    { id: 'slides', label: 'Slides' },
    { id: 'sheets', label: 'Sheets' },
    { id: 'images', label: 'Images' },
    { id: 'videos', label: 'Videos' },
    { id: 'other', label: 'Other files' },
  ]

  return order
    .map(cfg => ({
      id: cfg.id,
      label: cfg.label,
      files: groups[cfg.id],
    }))
    .filter(group => group.files.length > 0)
}

export function Sidebar({
  notes,
  files,
  uploadingFiles = [],
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
  const [notesOpen, setNotesOpen] = useState(true)
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [openFileGroups, setOpenFileGroups] = useState<Record<FileGroupId, boolean>>({
    pdf: true,
    doc: true,
    slides: true,
    sheets: true,
    images: true,
    videos: true,
    other: true,
  })

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

  const fileGroups = groupFiles(files)

  return (
    <aside className="ide-sidebar">
      <div className="ide-sidebar-section">
        <div className="ide-sidebar-header-row">
          <span className="ide-sidebar-section-title">LEARNING_IDE</span>
          <button
            type="button"
            className="ide-add-note-btn"
            onClick={() => onAddNote('新筆記')}
            title="加新筆記"
            aria-label="加新筆記"
          >
            +
          </button>
        </div>
        <div
          className={`ide-sidebar-dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="ide-sidebar-dropzone-text">拖放檔案到呢度</span>
          <span className="ide-sidebar-dropzone-hint">docx, pptx, pdf, excel, 圖, 片…</span>
        </div>
        <div className="ide-sidebar-file-group">
          <div
            className="ide-sidebar-file-group-header"
            onClick={() => setNotesOpen(open => !open)}
          >
            <span className="ide-sidebar-file-group-chevron">
              {notesOpen ? '▼' : '▶'}
            </span>
            <span className="ide-sidebar-file-group-title">Notes</span>
            <span className="ide-sidebar-file-group-count">{notes.length}</span>
          </div>
          {notesOpen &&
            notes.map(note => (
              <div
                key={note.id}
                className={`ide-sidebar-item ${activeNoteId === note.id && !activeFileId ? 'active' : ''}`}
                onClick={() => onSelectNote(note.id)}
              >
                <span className="icon">📄</span>
                <span className="ide-sidebar-item-name" title={note.name}>{note.name}</span>
              </div>
            ))}
        </div>
        {uploadingFiles.length > 0 && (
          <div className="ide-sidebar-file-group">
            <div className="ide-sidebar-file-group-header">
              <span className="ide-sidebar-file-group-chevron">▼</span>
              <span className="ide-sidebar-file-group-title">上傳中</span>
              <span className="ide-sidebar-file-group-count">{uploadingFiles.length}</span>
            </div>
            {uploadingFiles.map((uf) => (
              <div key={uf.id} className="ide-sidebar-item ide-sidebar-item-file ide-sidebar-item-uploading">
                <span className="icon ide-sidebar-upload-icon">
                  {uf.progress < 100 ? (
                    <span className="ide-sidebar-upload-spinner" aria-hidden="true" />
                  ) : (
                    '✓'
                  )}
                </span>
                <span className="ide-sidebar-item-name" title={uf.name}>{uf.name}</span>
                <span className="ide-sidebar-upload-progress">{uf.progress}%</span>
              </div>
            ))}
          </div>
        )}
        {fileGroups.map(group => {
          const isOpen = openFileGroups[group.id] ?? true
          return (
            <div key={group.id} className="ide-sidebar-file-group">
              <div
                className="ide-sidebar-file-group-header"
                onClick={() =>
                  setOpenFileGroups(prev => ({ ...prev, [group.id]: !isOpen }))
                }
              >
                <span className="ide-sidebar-file-group-chevron">
                  {isOpen ? '▼' : '▶'}
                </span>
                <span className="ide-sidebar-file-group-title">{group.label}</span>
                <span className="ide-sidebar-file-group-count">{group.files.length}</span>
              </div>
              {isOpen &&
                group.files.map(file => (
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
          )
        })}
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
