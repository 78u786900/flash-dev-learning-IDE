import { useState, useRef, useEffect, useCallback } from 'react'
import type { Note, Section, SectionRecording } from '../types'
import { NoteContentWithLatex } from './NoteContentWithLatex'

/** Convert data URL to Blob so we can use createObjectURL for reliable playback (data URLs often fail with WebM in audio elements). */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const i = dataUrl.indexOf(',')
  if (i < 0) return null
  const header = dataUrl.slice(0, i)
  const base64 = dataUrl.slice(i + 1)
  // Preserve full MIME e.g. "audio/webm;codecs=opus" (regex [^;]+ only gave "audio/webm" and broke playback)
  const mimeMatch = header.match(/^data:([^,]+)/)
  const mimeRaw = mimeMatch ? mimeMatch[1].trim() : ''
  const mime = mimeRaw.replace(/;base64$/i, '') || 'audio/webm'
  try {
    const binary = atob(base64)
    const arr = new Uint8Array(binary.length)
    for (let j = 0; j < binary.length; j++) arr[j] = binary.charCodeAt(j)
    return new Blob([arr], { type: mime })
  } catch {
    return null
  }
}

/** Renders an audio element using a blob URL derived from dataUrl so playback and duration work (data URLs often don't with WebM). */
function RecordingAudio({ dataUrl, recId, className, controlsList }: { dataUrl: string; recId: string; className?: string; controlsList?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const blob = dataUrlToBlob(dataUrl)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [dataUrl, recId])
  useEffect(() => {
    if (objectUrl && audioRef.current) {
      audioRef.current.load()
    }
  }, [objectUrl])
  return (
    <audio
      ref={audioRef}
      key={objectUrl ? `${recId}-ready` : recId}
      src={objectUrl ?? ''}
      controls
      preload="auto"
      className={className}
      controlsList={controlsList}
    />
  )
}

interface CanvasProps {
  note: Note
  onUpdateSection: (sectionId: string, updater: (s: Section) => Section) => void
  onAddSection: () => void
  onSectionDone?: (title: string) => void
  onRequestDeleteSection?: (sectionId: string) => void
  onRequestDeleteRecording?: (sectionId: string, recId: string) => void
}

export function Canvas({ note, onUpdateSection, onAddSection, onSectionDone, onRequestDeleteSection, onRequestDeleteRecording }: CanvasProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [recordingSectionId, setRecordingSectionId] = useState<string | null>(null)
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0)
  const [pendingRecording, setPendingRecording] = useState<{ sectionId: string; blob: Blob; duration: number } | null>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const startTimeRef = useRef<number>(0)
  const recordingSectionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!recordingSectionId) {
      setRecordingElapsedSeconds(0)
      return
    }
    const tick = () => setRecordingElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [recordingSectionId])

  const startRecording = useCallback(async (sectionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      let recorder: MediaRecorder
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      } else {
        recorder = new MediaRecorder(stream)
      }
      const chunks: Blob[] = []
      startTimeRef.current = Date.now()
      recordingSectionIdRef.current = sectionId
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const sid = recordingSectionIdRef.current
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        const mimeType = recorder.mimeType || 'audio/webm'
        recordingSectionIdRef.current = null
        setTimeout(() => {
          const blob = new Blob(chunks, { type: mimeType })
          if (sid && blob.size > 0) setPendingRecording({ sectionId: sid, blob, duration })
        }, 80)
      }
      recorder.start(250)
      mediaRecorderRef.current = recorder
      setRecordingSectionId(sectionId)
    } catch (err) {
      console.warn('Recording not available:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current
    const sectionId = recordingSectionId
    if (!rec || rec.state !== 'recording' || !sectionId) return
    mediaRecorderRef.current = null
    setRecordingSectionId(null)
    // Request any buffered data first so we don't lose the last ~250ms; then stop (which fires final dataavailable).
    try {
      rec.requestData()
    } catch {
      // ignore if not supported
    }
    requestAnimationFrame(() => {
      rec.stop()
    })
  }, [recordingSectionId])

  const finishRecording = useCallback(() => {
    if (!pendingRecording) return
    const { sectionId, blob, duration } = pendingRecording
    if (blob.size === 0) {
      setPendingRecording(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (!dataUrl || !dataUrl.startsWith('data:audio/')) {
        setPendingRecording(null)
        return
      }
      const newRec: SectionRecording = { id: `rec-${Date.now()}`, dataUrl, duration }
      onUpdateSection(sectionId, (s) => ({
        ...s,
        recordings: [...(s.recordings ?? []), newRec],
      }))
      setPendingRecording(null)
    }
    reader.onerror = () => setPendingRecording(null)
    reader.readAsDataURL(blob)
  }, [pendingRecording, onUpdateSection])

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
            <div className="ide-section-recording-wrap">
              <span
                className={`ide-recording-timer ${recordingSectionId === section.id ? 'ide-recording-timer--active' : ''}`}
                aria-live="polite"
              >
                {recordingSectionId === section.id
                  ? `${Math.floor(recordingElapsedSeconds / 60)}:${(recordingElapsedSeconds % 60).toString().padStart(2, '0')}`
                  : '\u00A0'}
              </span>
              <button
                type="button"
                className={`ide-btn-record ${recordingSectionId === section.id ? 'recording' : ''}`}
                onClick={() => startRecording(section.id)}
                title="開始錄音"
                aria-label="開始錄音"
                disabled={recordingSectionId != null || (pendingRecording?.sectionId === section.id)}
              />
              <button
                type="button"
                className="ide-btn-stop"
                onClick={stopRecording}
                title="停止"
                aria-label="停止"
                disabled={recordingSectionId !== section.id}
              >
                停止
              </button>
              <button
                type="button"
                className="ide-btn-finish"
                onClick={finishRecording}
                title="完成並保存"
                aria-label="完成並保存"
                disabled={!pendingRecording || pendingRecording.sectionId !== section.id}
              >
                完成
              </button>
            </div>
          </div>
          {((section.recordings?.length ?? 0) > 0 || (pendingRecording?.sectionId === section.id)) && (
            <div className="ide-section-recordings">
              <span className="ide-section-recordings-label">錄音</span>
              <div className="ide-section-recordings-list">
                {section.recordings?.map((rec) => (
                  <div key={rec.id} className="ide-recording-card">
                    <button
                      type="button"
                      className="ide-recording-delete"
                      onClick={() => {
                        if (onRequestDeleteRecording) onRequestDeleteRecording(section.id, rec.id)
                        else onUpdateSection(section.id, (s) => ({ ...s, recordings: (s.recordings ?? []).filter((r) => r.id !== rec.id) }))
                      }}
                      title="刪除此錄音"
                      aria-label="刪除此錄音"
                    >
                      ×
                    </button>
                    <RecordingAudio
                      recId={rec.id}
                      dataUrl={rec.dataUrl || ''}
                      className="ide-recording-audio"
                      controlsList="play nodownload"
                    />
                    {rec.duration != null && (
                      <span className="ide-recording-duration">{rec.duration}s</span>
                    )}
                  </div>
                ))}
                {pendingRecording?.sectionId === section.id && (
                  <div className="ide-recording-card ide-recording-card--pending">
                    <span className="ide-recording-card-badge">·</span>
                    <span className="ide-recording-pending-label">未保存 — 按「完成」保存</span>
                  </div>
                )}
              </div>
            </div>
          )}
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
