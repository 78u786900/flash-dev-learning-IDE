import { useState, useCallback, useEffect, useRef } from 'react'
import type { Note, Section, TimerPhase, DroppedFile, TimelineAction } from './types'
import type { AgentContext, ToolResultAction } from './agent/types'
import { getPdfPageTextOnDemand, getPdfPageImageOnDemand } from './agent/tools/pdfOnDemand'
import { embedForSearch as embedForSearchApi } from './agent/tools/embedding'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Canvas } from './components/Canvas'
import { FileViewer } from './components/FileViewer'
import { CanvasAreaWithSelection, type CanvasOverlayMemo } from './components/CanvasAreaWithSelection'
import { ChatPanel } from './components/ChatPanel'
import type { CanvasFileType } from './components/CanvasToolbar'
import { StatusBar } from './components/StatusBar'
import { CommandPalette } from './components/CommandPalette'
import { GrindingTimer } from './components/GrindingTimer'
import { ConfirmDialog } from './components/ConfirmDialog'
import {
  loadNotes as loadNotesSync,
  loadTimeline as loadTimelineSync,
  loadChatThreads as loadChatThreadsSync,
  loadCanvasOverlays as loadCanvasOverlaysSync,
  type StoredChatMessage,
  type StoredChatThread,
} from './storage/persistence'
import {
  loadAllFromCloud,
  saveNotes,
  saveTimeline,
  saveChatThreads,
  saveCanvasOverlays,
  loadFiles,
  uploadFile as uploadFileToCloud,
  renameFile as renameFileInCloud,
  deleteFile as deleteFileFromCloud,
  type CloudFile,
} from './storage/cloudStorage'
import { useAuth } from './contexts/AuthContext'
import { filesApi } from './api/client'

const defaultNote: Note = {
  id: '1',
  name: '我的第一份筆記',
  createdAt: Date.now(),
  sections: [
    { id: 's1', title: '第一章：入門', content: '喺呢度寫筆記；數學用 LaTeX：行內 $...$、獨立 $$...$$，例如 $E=mc^2$。', done: false },
    { id: 's2', title: '第二章：練習', content: '每個 section 可以標記「完成」，進度會喺下面 status bar 顯示。', done: false },
  ],
}

function makeTimelineAction(type: TimelineAction['type'], label: string): TimelineAction {
  return { id: `t${Date.now()}_${Math.random().toString(36).slice(2)}`, type, label, at: Date.now() }
}

function createDefaultNote(): Note {
  const id = `n${Date.now()}`
  return {
    id,
    name: '我的第一份筆記',
    createdAt: Date.now(),
    sections: [
      { id: `s${Date.now()}`, title: '第一章：入門', content: '喺呢度寫筆記；數學用 LaTeX：行內 $...$、獨立 $$...$$。', done: false },
    ],
  }
}

const DEFAULT_CHAT_WELCOME: StoredChatMessage = {
  role: 'agent',
  text: '你好！我係 Learning IDE 嘅 AI Agent，我有以下工具可以用：\n• **筆記**：整理口語成筆記、總結/擴寫 section、抽關鍵詞、出題、合併 section、建議結構\n• **PDF**：總結頁、頁轉筆記、出問答題、抽定義\n\n你可以話「將呢段整理成筆記」「總結第二章」「根據呢章出 3 條題」「呢頁變成我筆記嘅一節」等。試下喺左邊畫布揀好內容再同我講。',
}

function makeInitialChatThreads(): StoredChatThread[] {
  const loaded = loadChatThreadsSync()
  if (loaded.length) return loaded
  const now = Date.now()
  return [
    {
      id: `chat-${now}`,
      title: 'Chat 1',
      messages: [DEFAULT_CHAT_WELCOME],
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/** Returns initial threads and the latest chat id (for default active on load/refresh). */
function getInitialChatState(): { threads: StoredChatThread[]; activeId: string } {
  const threads = makeInitialChatThreads()
  const sorted = [...threads].sort(
    (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
  )
  const activeId = sorted[0]?.id ?? threads[0]?.id ?? `chat-${Date.now()}`
  return { threads, activeId }
}

function App() {
  const { isAuthenticated } = useAuth()
  const [notes, setNotes] = useState<Note[]>(() => loadNotesSync() ?? [defaultNote])
  const [files, setFiles] = useState<DroppedFile[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    const loaded = loadNotesSync()
    if (loaded?.length) return loaded[0].id
    return defaultNote.id
  })
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineAction[]>(() => loadTimelineSync())
  const [chatThreads, setChatThreads] = useState<StoredChatThread[]>(() => getInitialChatState().threads)
  const [activeChatId, setActiveChatId] = useState<string>(() => getInitialChatState().activeId)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'deleteFile' | 'deleteChat' | 'deleteNote' | 'deleteSection' | 'deleteRecording' | 'deleteCodeWindow' | null
    fileId?: string
    chatId?: string
    noteId?: string
    sectionIds?: string[]
    sectionId?: string
    recId?: string
    codeWindowId?: string
  }>({ open: false, type: null })
  const [fullscreenLock, setFullscreenLock] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle')
  const [timerSeconds, setTimerSeconds] = useState(25 * 60)
  const [attachedAreaImage, setAttachedAreaImage] = useState<string | null>(null)
  const [pdfPageTexts, setPdfPageTexts] = useState<Record<number, string>>({})
  const [pdfFileIdForTexts, setPdfFileIdForTexts] = useState<string | null>(null)
  const [pdfChapters, setPdfChapters] = useState<Array<{ title: string; page: number }>>([])
  const [pdfChaptersFileId, setPdfChaptersFileId] = useState<string | null>(null)
  const [totalPdfPagesFromDoc, setTotalPdfPagesFromDoc] = useState<number | null>(null)
  /** Last PDF selected so PDF tools still work when user is viewing a note (agent "remembers" which PDF). */
  const [lastUsedPdfFile, setLastUsedPdfFile] = useState<DroppedFile | null>(null)
  /** PDF page number the user is currently viewing in the middle section (1-based). Agent uses this for "this page". */
  const [viewingPdfPageNumber, setViewingPdfPageNumber] = useState<number | null>(null)
  const lastPdfFileIdForViewing = useRef<string | null>(null)
  /** Ref so PDF load callbacks only apply when this file is still active (avoids stale overwrites). */
  const activeFileIdRef = useRef<string | null>(null)
  /** Overlay memos on the central canvas, keyed by note/file. */
  const [canvasOverlaysByKey, setCanvasOverlaysByKey] = useState<Record<string, CanvasOverlayMemo[]>>(
    () => {
      const stored = loadCanvasOverlaysSync()
      const cast: Record<string, CanvasOverlayMemo[]> = {}
      for (const [key, value] of Object.entries(stored)) {
        if (Array.isArray(value)) {
          cast[key] = value.map((v: any) => ({
            id: String(v.id ?? `memo-${Date.now()}`),
            x: typeof v.x === 'number' ? v.x : 0,
            y: typeof v.y === 'number' ? v.y : 0,
            width: typeof v.width === 'number' ? v.width : 220,
            height: typeof v.height === 'number' ? v.height : 140,
            content: typeof v.content === 'string' ? v.content : '',
          }))
        }
      }
      return cast
    }
  )
  const [history, setHistory] = useState<Array<{ notes: Note[]; files: DroppedFile[] }>>([])
  const [future, setFuture] = useState<Array<{ notes: Note[]; files: DroppedFile[] }>>([])

  const logAction = useCallback((type: TimelineAction['type'], label: string) => {
    setTimeline(prev => [...prev.slice(-99), makeTimelineAction(type, label)])
  }, [])

  const snapshotState = useCallback(() => {
    return {
      notes: JSON.parse(JSON.stringify(notes)) as Note[],
      files: JSON.parse(JSON.stringify(files)) as DroppedFile[],
    }
  }, [notes, files])

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev, snapshotState()])
    setFuture([])
  }, [snapshotState])

  const canUndo = history.length > 0
  const canRedo = future.length > 0

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (!prev.length) return prev
      const last = prev[prev.length - 1]
      setFuture(f => [...f, snapshotState()])
      setNotes(last.notes)
      setFiles(last.files)
      return prev.slice(0, -1)
    })
  }, [snapshotState])

  const handleRedo = useCallback(() => {
    setFuture(prev => {
      if (!prev.length) return prev
      const last = prev[prev.length - 1]
      setHistory(h => [...h, snapshotState()])
      setNotes(last.notes)
      setFiles(last.files)
      return prev.slice(0, -1)
    })
  }, [snapshotState])

  const onReadingPosition = useCallback(
    (payload: { fileName: string; page: number }) => {
      setViewingPdfPageNumber(payload.page)
      logAction('reading_position', `Reading: ${payload.fileName}, page ${payload.page}`)
    },
    [logAction]
  )

  /** Stable so FileViewer effect does not restart PDF text load on every render. Only apply when loaded file is still active. */
  const onPdfTextLoaded = useCallback((pages: Record<number, string>, fileId: string, totalPages?: number) => {
    if (activeFileIdRef.current !== fileId) return
    setPdfPageTexts(prev => ({ ...prev, ...pages }))
    setPdfFileIdForTexts(fileId)
    if (totalPages != null) setTotalPdfPagesFromDoc(totalPages)
  }, [])
  const onPdfChaptersLoaded = useCallback((chapters: { title: string; page: number }[], fileId: string, totalPages?: number) => {
    if (activeFileIdRef.current !== fileId) return
    setPdfChapters(chapters)
    setPdfChaptersFileId(fileId)
    if (totalPages != null) setTotalPdfPagesFromDoc(totalPages)
  }, [])

  const activeNote = notes.find(n => n.id === (activeNoteId ?? '')) ?? notes[0]
  const activeFile = files.find(f => f.id === activeFileId) ?? null
  activeFileIdRef.current = activeFileId

  /** Guard: avoid blank screen if notes empty or activeNote missing (effect will fix state) */
  const safeNote = activeNote ?? notes[0]
  if (!safeNote) {
    return (
      <div className="ide-layout">
        <Header onToggleLock={() => {}} onOpenCommand={() => setCommandOpen(true)} onOpenTimer={() => setTimerOpen(v => !v)} fullscreenLock={fullscreenLock} onUndo={() => {}} onRedo={() => {}} canUndo={false} canRedo={false} />
        <div className="ide-main" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-dim)' }}>載入中…</p>
        </div>
      </div>
    )
  }

  const updateNote = useCallback((noteId: string, updater: (n: Note) => Note) => {
    pushHistory()
    setNotes(prev => prev.map(n => n.id === noteId ? updater(n) : n))
  }, [pushHistory])

  const updateSection = useCallback((noteId: string, sectionId: string, updater: (s: Section) => Section) => {
    updateNote(noteId, n => ({
      ...n,
      sections: n.sections.map(s => s.id === sectionId ? updater(s) : s),
    }))
  }, [updateNote])

  const addSection = useCallback((noteId: string) => {
    pushHistory()
    updateNote(noteId, n => ({
      ...n,
      sections: [
        ...n.sections,
        { id: `s${Date.now()}`, title: '新章節', content: '', done: false },
      ],
    }))
    logAction('added_section', '加咗新章節')
  }, [updateNote, logAction, pushHistory])

  const addSectionWithContent = useCallback((noteId: string, title: string, content: string) => {
    pushHistory()
    updateNote(noteId, n => ({
      ...n,
      sections: [
        ...n.sections,
        { id: `s${Date.now()}`, title, content, done: false },
      ],
    }))
    logAction('added_section', `加咗章節「${title}」`)
  }, [updateNote, logAction, pushHistory])

  const addNote = useCallback((name: string) => {
    pushHistory()
    const newNote: Note = {
      id: `n${Date.now()}`,
      name: name || '未命名筆記',
      createdAt: Date.now(),
      sections: [{ id: `s${Date.now()}`, title: '第一章', content: '', done: false }],
    }
    setNotes(prev => [...prev, newNote])
    setActiveNoteId(newNote.id)
    setActiveFileId(null)
    logAction('created_note', `建立筆記「${newNote.name}」`)
  }, [logAction, pushHistory])

  const reorderSections = useCallback((noteId: string, sectionIds: string[]) => {
    pushHistory()
    setNotes(prev =>
      prev.map(n => {
        if (n.id !== noteId) return n
        const byId = new Map(n.sections.map(s => [s.id, s]))
        const ordered = sectionIds.map(id => byId.get(id)).filter(Boolean) as Section[]
        if (ordered.length !== n.sections.length) return n
        return { ...n, sections: ordered }
      })
    )
    logAction('section_edited', '已調整章節順序')
  }, [logAction, pushHistory])

  const renameNote = useCallback((noteId: string, name: string) => {
    pushHistory()
    setNotes(prev => prev.map(n => (n.id === noteId ? { ...n, name: name || '未命名筆記' } : n)))
    logAction('section_edited', `筆記改名為「${name || '未命名筆記'}」`)
  }, [logAction, pushHistory])

  const deleteNote = useCallback((noteId: string) => {
    pushHistory()
    setNotes(prev => {
      const next = prev.filter(n => n.id !== noteId)
      if (next.length === 0) {
        const fallback = createDefaultNote()
        setActiveNoteId(fallback.id)
        return [fallback]
      }
      if (activeNoteId === noteId) {
        setActiveNoteId(next[0].id)
      }
      return next
    })
    logAction('section_edited', '已刪除筆記')
  }, [activeNoteId, pushHistory])

  const deleteSection = useCallback((noteId: string, sectionIds: string[]) => {
    pushHistory()
    setNotes(prev =>
      prev.map(n => {
        if (n.id !== noteId) return n
        const toRemove = new Set(sectionIds)
        const sections = n.sections.filter(s => !toRemove.has(s.id))
        return sections.length < n.sections.length ? { ...n, sections } : n
      })
    )
    logAction('section_edited', `已刪除 ${sectionIds.length} 個章節`)
  }, [logAction, pushHistory])

  /** Create a new note, switch to it, and return the full Note. Used by agent create_note tool so sections can be added in the same run (context.lastCreatedNote). */
  const createNoteAndReturnId = useCallback((name: string): Note => {
    pushHistory()
    const newNote: Note = {
      id: `n${Date.now()}`,
      name: name || '未命名筆記',
      createdAt: Date.now(),
      sections: [{ id: `s${Date.now()}`, title: '第一章', content: '', done: false }],
    }
    setNotes(prev => [...prev, newNote])
    setActiveNoteId(newNote.id)
    setActiveFileId(null)
    logAction('created_note', `建立筆記「${newNote.name}」`)
    return newNote
  }, [logAction, pushHistory])

  /** When authenticated, load notes/timeline/chat/overlays from Google Drive (cloud) */
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    loadAllFromCloud()
      .then((data) => {
        if (cancelled || !data) return
        if (data.notes.length > 0) {
          setNotes(data.notes)
          setActiveNoteId((prev) => (data.notes.some((n) => n.id === prev) ? prev : data.notes[0].id))
        }
        if (data.timeline.length > 0) setTimeline(data.timeline)
        if (data.chatThreads.length > 0) {
          setChatThreads(data.chatThreads)
          const sorted = [...data.chatThreads].sort(
            (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
          )
          setActiveChatId(sorted[0]?.id ?? data.chatThreads[0].id)
        }
        if (Object.keys(data.canvasOverlays).length > 0) setCanvasOverlaysByKey(data.canvasOverlays)
      })
      .catch((err) => console.error('Load from cloud failed', err))
    return () => { cancelled = true }
  }, [isAuthenticated])

  /** Load files: from cloud when authenticated, else from IndexedDB */
  useEffect(() => {
    let cancelled = false
    loadFiles()
      .then((loaded) => {
        if (!cancelled) setFiles(loaded)
      })
      .catch((err) => console.error('Load files failed', err))
    return () => { cancelled = true }
  }, [isAuthenticated])

  const addFiles = useCallback(async (fileList: File[]) => {
    const added: DroppedFile[] = []
    for (const file of fileList) {
      try {
        const result = await uploadFileToCloud(file)
        if (result) added.push(result)
      } catch (err) {
        console.error('Save file failed', file.name, err)
      }
    }
    if (added.length) {
      setFiles(prev => [...prev, ...added])
      added.forEach(f => logAction('dropped_file', `加入檔案「${f.name}」`))
    }
  }, [logAction])

  const renameFile = useCallback(async (id: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const file = files.find(f => f.id === id) as CloudFile | undefined
    const driveFileId = file?.driveFileId
    try {
      const ok = await renameFileInCloud(id, trimmed, driveFileId)
      if (ok) {
        setFiles(prev => prev.map(f => (f.id === id ? { ...f, name: trimmed } : f)))
        logAction('section_edited', `檔案改名為「${trimmed}」`)
      }
    } catch (err) {
      console.error('Rename file failed', err)
    }
  }, [logAction, files])

  const requestDeleteFile = useCallback((id: string) => {
    setConfirmDialog({ open: true, type: 'deleteFile', fileId: id })
  }, [])

  const requestDeleteNote = useCallback((noteId: string) => {
    setConfirmDialog({ open: true, type: 'deleteNote', noteId })
  }, [])

  const requestDeleteSection = useCallback((noteId: string, sectionIds: string[]) => {
    setConfirmDialog({ open: true, type: 'deleteSection', noteId, sectionIds })
  }, [])

  const requestDeleteRecording = useCallback((noteId: string, sectionId: string, recId: string) => {
    setConfirmDialog({ open: true, type: 'deleteRecording', noteId, sectionId, recId })
  }, [])

  const requestDeleteCodeWindow = useCallback((noteId: string, sectionId: string, codeWindowId: string) => {
    setConfirmDialog({ open: true, type: 'deleteCodeWindow', noteId, sectionId, codeWindowId })
  }, [])

  const performDeleteFile = useCallback((id: string) => {
    pushHistory()
    const file = files.find(f => f.id === id) as CloudFile | undefined
    if (file?.url?.startsWith('blob:')) URL.revokeObjectURL(file.url)
    deleteFileFromCloud(id, file?.driveFileId)
      .then(() => {
        setFiles(prev => prev.filter(f => f.id !== id))
        setActiveFileId(prev => (prev === id ? null : prev))
        setLastUsedPdfFile(prev => (prev?.id === id ? null : prev))
        logAction('section_edited', '已刪除檔案')
      })
      .catch((err) => console.error('Delete file failed', err))
  }, [files, pushHistory])

  const requestDeleteChat = useCallback((id: string) => {
    setConfirmDialog({ open: true, type: 'deleteChat', chatId: id })
  }, [])

  const performDeleteChat = useCallback((id: string) => {
    setChatThreads((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        const now = Date.now()
        const fallback: StoredChatThread = {
          id: `chat-${now}`,
          title: 'Chat 1',
          messages: [DEFAULT_CHAT_WELCOME],
          createdAt: now,
          updatedAt: now,
        }
        setActiveChatId(fallback.id)
        return [fallback]
      }
      if (activeChatId === id) {
        const sorted = [...next].sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
        setActiveChatId(sorted[0]?.id ?? next[0].id)
      }
      return next
    })
  }, [activeChatId])

  const handleConfirmDialogConfirm = useCallback(() => {
    if (confirmDialog.type === 'deleteFile' && confirmDialog.fileId) {
      performDeleteFile(confirmDialog.fileId)
    } else if (confirmDialog.type === 'deleteChat' && confirmDialog.chatId) {
      performDeleteChat(confirmDialog.chatId)
    } else if (confirmDialog.type === 'deleteNote' && confirmDialog.noteId) {
      deleteNote(confirmDialog.noteId)
    } else if (confirmDialog.type === 'deleteSection' && confirmDialog.noteId && confirmDialog.sectionIds?.length) {
      deleteSection(confirmDialog.noteId, confirmDialog.sectionIds)
    } else if (confirmDialog.type === 'deleteRecording' && confirmDialog.noteId && confirmDialog.sectionId && confirmDialog.recId) {
      updateSection(confirmDialog.noteId, confirmDialog.sectionId, (s) => ({
        ...s,
        recordings: (s.recordings ?? []).filter((r) => r.id !== confirmDialog.recId),
      }))
    } else if (confirmDialog.type === 'deleteCodeWindow' && confirmDialog.noteId && confirmDialog.sectionId && confirmDialog.codeWindowId) {
      updateSection(confirmDialog.noteId, confirmDialog.sectionId, (s) => ({
        ...s,
        codeWindows: (s.codeWindows ?? []).filter((w) => w.id !== confirmDialog.codeWindowId),
      }))
    }
    setConfirmDialog({ open: false, type: null })
  }, [confirmDialog.type, confirmDialog.fileId, confirmDialog.chatId, confirmDialog.noteId, confirmDialog.sectionIds, confirmDialog.sectionId, confirmDialog.recId, confirmDialog.codeWindowId, performDeleteFile, performDeleteChat, deleteNote, deleteSection, updateSection])

  const handleConfirmDialogCancel = useCallback(() => {
    setConfirmDialog({ open: false, type: null })
  }, [])

  const selectNote = useCallback((id: string) => {
    setActiveNoteId(id)
    setActiveFileId(null)
    const note = notes.find(n => n.id === id)
    if (note) logAction('opened_note', `打開筆記「${note.name}」`)
  }, [notes, logAction])

  const selectFile = useCallback(async (id: string) => {
    const file = files.find(f => f.id === id) as CloudFile | undefined
    if (file?.driveFileId && (!file.url || file.url === '')) {
      try {
        const blob = await filesApi.download(id)
        if (blob) {
          const url = URL.createObjectURL(blob)
          setFiles(prev => prev.map(f => (f.id === id ? { ...f, url } : f)))
        }
      } catch (err) {
        console.error('Fetch file for view failed', err)
      }
    }
    setActiveFileId(id)
    setActiveNoteId(null)
    if (file) {
      logAction('opened_file', `打開檔案「${file.name}」`)
      if (file.name?.toLowerCase().endsWith('.pdf')) setLastUsedPdfFile(file)
    }
  }, [files, logAction])

  const progress = safeNote.sections.length
    ? Math.round((safeNote.sections.filter(s => s.done).length / safeNote.sections.length) * 100)
    : 0

  /** When not authenticated, on mount/pageshow sync from local storage. When authenticated, cloud load effect handles it. */
  useEffect(() => {
    if (isAuthenticated) return
    const syncNotesFromStorage = () => {
      const loaded = loadNotesSync()
      if (loaded != null && loaded.length > 0) {
        setNotes(loaded)
        setActiveNoteId(prev => (loaded.some(n => n.id === prev) ? prev : loaded[0].id))
      }
    }
    syncNotesFromStorage()
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) syncNotesFromStorage()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [isAuthenticated])

  /** Prevent blank screen: ensure we never have empty notes or stale activeNoteId */
  useEffect(() => {
    if (notes.length === 0) {
      const fallback = createDefaultNote()
      setNotes([fallback])
      setActiveNoteId(fallback.id)
      return
    }
    const currentExists = notes.some(n => n.id === activeNoteId)
    if (!currentExists && activeNoteId != null) {
      setActiveNoteId(notes[0].id)
    }
  }, [notes.length, notes, activeNoteId])

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  useEffect(() => {
    saveTimeline(timeline)
  }, [timeline])

  useEffect(() => {
    saveChatThreads(chatThreads)
  }, [chatThreads])

  useEffect(() => {
    saveCanvasOverlays(canvasOverlaysByKey)
  }, [canvasOverlaysByKey])

  useEffect(() => {
    if (activeFile?.name?.toLowerCase().endsWith('.pdf') && activeFile.id !== pdfFileIdForTexts) {
      setPdfPageTexts({})
      setPdfFileIdForTexts(null)
    }
    if (activeFile?.name?.toLowerCase().endsWith('.pdf') && activeFile.id !== pdfChaptersFileId) {
      setPdfChapters([])
      setPdfChaptersFileId(null)
      setTotalPdfPagesFromDoc(null)
    }
    if (activeFile?.name?.toLowerCase().endsWith('.pdf')) {
      if (lastPdfFileIdForViewing.current !== activeFile.id) {
        lastPdfFileIdForViewing.current = activeFile.id
        setViewingPdfPageNumber(1)
      }
    } else {
      lastPdfFileIdForViewing.current = null
      setViewingPdfPageNumber(null)
    }
  }, [activeFile?.id, activeFile?.name, pdfFileIdForTexts, pdfChaptersFileId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showCanvas = !activeFileId
  const displayNote = showCanvas ? (activeNote ?? notes[0]) : notes[0]

  const canvasFileType: CanvasFileType = !activeFileId
    ? 'note'
    : activeFile?.name.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : activeFile?.type.startsWith('image/')
        ? 'image'
        : activeFile?.type.startsWith('video/')
          ? 'video'
          : 'other'

  const pdfFile = (activeFile?.name?.toLowerCase().endsWith('.pdf') ? activeFile : null) ?? lastUsedPdfFile
  const isPdf = !!pdfFile
  const usePdfTexts = isPdf && pdfFile && pdfFile.id === pdfFileIdForTexts && Object.keys(pdfPageTexts).length > 0
  const usePdfChapters = isPdf && pdfFile && pdfFile.id === pdfChaptersFileId && pdfChapters.length > 0
  const currentPdfPage = activeFile?.name?.toLowerCase().endsWith('.pdf') ? (viewingPdfPageNumber ?? 1) : undefined
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const agentContext: AgentContext = {
    note: displayNote,
    notes,
    files,
    file: (activeFile ?? lastUsedPdfFile) ?? undefined,
    fileType: !activeFileId ? (lastUsedPdfFile ? 'pdf' : 'note') : isPdf ? 'pdf' : activeFile?.type.startsWith('image/') ? 'image' : activeFile?.type.startsWith('video/') ? 'video' : 'other',
    pageNumber: currentPdfPage,
    pdfPageTexts: usePdfTexts ? pdfPageTexts : undefined,
    totalPdfPages: usePdfTexts ? Math.max(...Object.keys(pdfPageTexts).map(Number)) : (isPdf && totalPdfPagesFromDoc ? totalPdfPagesFromDoc : undefined),
    pdfChapters: usePdfChapters ? pdfChapters : undefined,
    createNote: createNoteAndReturnId,
    getPdfPageTextOnDemand: isPdf && pdfFile?.url ? getPdfPageTextOnDemand : undefined,
    getPdfPageImageOnDemand: isPdf && pdfFile?.url ? getPdfPageImageOnDemand : undefined,
    timeline: timeline.slice(-15).map((t) => ({ type: t.type, label: t.label, at: t.at })),
    embedForSearch: geminiApiKey?.trim() ? (query, documents) => embedForSearchApi(geminiApiKey!, query, documents) : undefined,
  }

  const activeThread = chatThreads.find(t => t.id === activeChatId) ?? chatThreads[0]
  const chatMessages: StoredChatMessage[] = activeThread?.messages ?? [DEFAULT_CHAT_WELCOME]

  // Key for storing/retrieving canvas overlays: tie to active note or file.
  const overlayKey = !activeFileId
    ? `note:${displayNote.id}`
    : activeFile
      ? activeFile.name.toLowerCase().endsWith('.pdf') && viewingPdfPageNumber
        ? `file:${activeFile.id}:page:${viewingPdfPageNumber}`
        : `file:${activeFile.id}`
      : null
  const currentCanvasOverlays: CanvasOverlayMemo[] =
    (overlayKey && canvasOverlaysByKey[overlayKey]) ? canvasOverlaysByKey[overlayKey] : []

  const handleToolAction = useCallback((action: ToolResultAction) => {
    if (action.type === 'add_section') {
      addSectionWithContent(action.noteId, action.title, action.content)
    } else if (action.type === 'merge_sections') {
      addSectionWithContent(action.noteId, action.newTitle, action.content)
    } else if (action.type === 'update_section') {
      updateSection(action.noteId, action.sectionId, s => ({
        ...s,
        ...(action.title != null && { title: action.title }),
        ...(action.content != null && { content: action.content }),
      }))
    } else if (action.type === 'reorder_sections') {
      reorderSections(action.noteId, action.sectionIds)
    } else if (action.type === 'rename_note') {
      renameNote(action.noteId, action.name)
    } else if (action.type === 'delete_note') {
      deleteNote(action.noteId)
    } else if (action.type === 'delete_section') {
      deleteSection(action.noteId, action.sectionIds)
    } else if (action.type === 'upsert_code_window') {
      pushHistory()
      updateSection(action.noteId, action.sectionId, (s) => {
        const existing = s.codeWindows ?? []
        const id = `code-${Date.now()}-${Math.random().toString(36).slice(2)}`
        return {
          ...s,
          codeWindows: [
            ...existing,
            {
              id,
              language: action.language,
              title: action.title,
              source: action.source,
              aspectRatio: action.aspectRatio ?? '5:3',
              model: action.model ?? 'gemini-3-pro',
            },
          ],
        }
      })
    }
  }, [addSectionWithContent, updateSection, reorderSections, renameNote, deleteNote, deleteSection])

  return (
    <div className={`ide-layout ${fullscreenLock ? 'fullscreen-lock' : ''}`}>
      <Header
        onToggleLock={() => setFullscreenLock(v => !v)}
        onOpenCommand={() => setCommandOpen(true)}
        onOpenTimer={() => setTimerOpen(v => !v)}
        fullscreenLock={fullscreenLock}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div className="ide-main">
        <Sidebar
          notes={notes}
          files={files}
          activeNoteId={activeNoteId}
          activeFileId={activeFileId}
          timeline={timeline}
          onSelectNote={selectNote}
          onSelectFile={selectFile}
          onAddNote={addNote}
          onDropFiles={addFiles}
          onRenameFile={renameFile}
          onDeleteFile={requestDeleteFile}
          onRequestDeleteNote={requestDeleteNote}
        />
        <div className="ide-canvas-wrap">
          <CanvasAreaWithSelection
            fileType={canvasFileType}
            onAddSection={showCanvas ? () => addSection(displayNote.id) : undefined}
            onCaptureArea={setAttachedAreaImage}
            noSelect={!showCanvas}
            overlays={overlayKey ? currentCanvasOverlays : undefined}
            onOverlaysChange={
              overlayKey
                ? (next) =>
                    setCanvasOverlaysByKey((prev) => ({
                      ...prev,
                      [overlayKey]: next,
                    }))
                : undefined
            }
          >
            {showCanvas ? (
              <Canvas
                note={displayNote}
                onUpdateSection={(sectionId, updater) => updateSection(displayNote.id, sectionId, updater)}
                onAddSection={() => addSection(displayNote.id)}
                onSectionDone={(title) => logAction('section_done', `完成章節「${title}」`)}
                onRequestDeleteSection={(sectionId) => requestDeleteSection(displayNote.id, [sectionId])}
                onRequestDeleteRecording={(sectionId, recId) => requestDeleteRecording(displayNote.id, sectionId, recId)}
                onRequestDeleteCodeWindow={(sectionId, codeWindowId) =>
                  requestDeleteCodeWindow(displayNote.id, sectionId, codeWindowId)
                }
              />
            ) : activeFile ? (
              <FileViewer
                file={activeFile}
                currentPdfPage={activeFile.name.toLowerCase().endsWith('.pdf') ? (viewingPdfPageNumber ?? 1) : undefined}
                totalPdfPages={
                  activeFile.name.toLowerCase().endsWith('.pdf') && (activeFile.id === pdfFileIdForTexts || activeFile.id === pdfChaptersFileId)
                    ? totalPdfPagesFromDoc ?? undefined
                    : undefined
                }
                onPdfPageChange={activeFile.name.toLowerCase().endsWith('.pdf') ? setViewingPdfPageNumber : undefined}
                onReadingPosition={activeFile.name.toLowerCase().endsWith('.pdf') ? onReadingPosition : undefined}
                onPdfTextLoaded={activeFile.name.toLowerCase().endsWith('.pdf') ? onPdfTextLoaded : undefined}
                onPdfChaptersLoaded={activeFile.name.toLowerCase().endsWith('.pdf') ? onPdfChaptersLoaded : undefined}
              />
            ) : null}
          </CanvasAreaWithSelection>
        </div>
        <ChatPanel
          agentContext={agentContext}
          messages={chatMessages}
          onMessagesChange={(updater) => {
            setChatThreads(prev =>
              prev.map(t =>
                t.id === activeChatId
                  ? { ...t, messages: updater(t.messages), updatedAt: Date.now() }
                  : t
              )
            )
          }}
          onToolAction={handleToolAction}
          attachedImage={attachedAreaImage}
          onClearAttached={() => setAttachedAreaImage(null)}
          chatTabs={chatThreads.map(t => ({ id: t.id, title: t.title }))}
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onRequestDeleteChat={requestDeleteChat}
          onNewChat={() => {
            const now = Date.now()
            const newThread: StoredChatThread = {
              id: `chat-${now}`,
              title: `Chat ${chatThreads.length + 1}`,
              messages: [DEFAULT_CHAT_WELCOME],
              createdAt: now,
              updatedAt: now,
            }
            setChatThreads(prev => [...prev, newThread])
            setActiveChatId(newThread.id)
          }}
        />
      </div>
      <StatusBar
        projectName="learning_IDE"
        progress={progress}
        errors={0}
        warnings={0}
      />
      {commandOpen && (
        <CommandPalette
          onClose={() => setCommandOpen(false)}
          onNewAgent={() => {}}
          onShowTerminal={() => {}}
          onHideFiles={() => {}}
          onSearchFiles={() => {}}
          onOpenBrowser={() => window.open('/', '_blank')}
          onMaximizeChat={() => {}}
        />
      )}
      {timerOpen && (
        <GrindingTimer
          phase={timerPhase}
          seconds={timerSeconds}
          onPhaseChange={setTimerPhase}
          onSecondsChange={setTimerSeconds}
          onClose={() => setTimerOpen(false)}
        />
      )}
      {confirmDialog.open && confirmDialog.type && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={
            confirmDialog.type === 'deleteFile' ? '刪除檔案' :
            confirmDialog.type === 'deleteChat' ? '刪除對話' :
            confirmDialog.type === 'deleteNote' ? '刪除筆記' :
            confirmDialog.type === 'deleteSection' ? '刪除此章節' :
            confirmDialog.type === 'deleteRecording' ? '刪除此錄音' :
            confirmDialog.type === 'deleteCodeWindow' ? '刪除此 Code Window' :
            '確認'
          }
          message={
            confirmDialog.type === 'deleteFile'
              ? '確定要刪除這個檔案？刪除後無法復原。'
              : confirmDialog.type === 'deleteChat'
              ? '確定要刪除這個對話？刪除後無法復原。'
              : confirmDialog.type === 'deleteNote'
              ? '確定要刪除這份筆記？刪除後無法復原。'
              : confirmDialog.type === 'deleteSection'
              ? '確定要刪除此章節？刪除後無法復原。'
              : confirmDialog.type === 'deleteRecording'
              ? '確定要刪除此段錄音？刪除後無法復原。'
              : confirmDialog.type === 'deleteCodeWindow'
              ? '確定要刪除此 Code Window？刪除後無法復原。'
              : ''
          }
          confirmLabel="刪除"
          cancelLabel="取消"
          danger
          onConfirm={handleConfirmDialogConfirm}
          onCancel={handleConfirmDialogCancel}
        />
      )}
    </div>
  )
}

export default App
