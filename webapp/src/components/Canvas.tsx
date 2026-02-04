import { useState, useRef, useEffect, useCallback } from 'react'
import type { Note, Section, SectionRecording, SectionCodeWindow } from '../types'
import { NoteContentWithLatex } from './NoteContentWithLatex'
import { transcribeWithGeminiFlash } from '../utils/audioTranscription'
import { CodeRenderWindow } from './CodeRenderWindow'
import { generateCodeWindowSource } from '../utils/geminiInline'

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
  /** Kept for backward compatibility; not used in current UI. */
  onRequestDeleteSection?: (sectionId: string) => void
  onRequestDeleteRecording?: (sectionId: string, recId: string) => void
  onRequestDeleteCodeWindow?: (sectionId: string, codeWindowId: string) => void
}

export function Canvas({
  note,
  onUpdateSection,
  onAddSection,
  onSectionDone,
  onRequestDeleteRecording,
  onRequestDeleteCodeWindow,
}: CanvasProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingCodeWindowId, setEditingCodeWindowId] = useState<string | null>(null)
  const [recordingSectionId, setRecordingSectionId] = useState<string | null>(null)
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0)
  const [pendingRecording, setPendingRecording] = useState<{ sectionId: string; blob: Blob; duration: number } | null>(null)
  const [transcribingRecId, setTranscribingRecId] = useState<string | null>(null)
  const [transcribingElapsedSeconds, setTranscribingElapsedSeconds] = useState(0)
  const [generatingCodeWindowId, setGeneratingCodeWindowId] = useState<string | null>(null)
  const [refreshNonceById, setRefreshNonceById] = useState<Record<string, number>>({})
  const editRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const startTimeRef = useRef<number>(0)
  const recordingSectionIdRef = useRef<string | null>(null)
  const transcribingStartRef = useRef<number>(0)

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

  useEffect(() => {
    if (!transcribingRecId) {
      setTranscribingElapsedSeconds(0)
      return
    }
    const tick = () => {
      setTranscribingElapsedSeconds(Math.max(0, Math.floor((Date.now() - transcribingStartRef.current) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [transcribingRecId])

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

  const handleTranscribeRecording = useCallback(
    async (sectionId: string, rec: SectionRecording) => {
      const blob = dataUrlToBlob(rec.dataUrl)
      if (!blob) return
      setTranscribingRecId(rec.id)
      transcribingStartRef.current = Date.now()
      onUpdateSection(sectionId, (s) => ({
        ...s,
        recordings: (s.recordings ?? []).map((r) =>
          r.id === rec.id
            ? {
                ...r,
                transcriptionStatus: 'processing',
                transcriptError: undefined,
              }
            : r
        ),
      }))
      try {
        const { language, segments } = await transcribeWithGeminiFlash(blob)
        onUpdateSection(sectionId, (s) => ({
          ...s,
          recordings: (s.recordings ?? []).map((r) =>
            r.id === rec.id
              ? {
                  ...r,
                  transcriptionStatus: 'done',
                  transcriptLanguage: language,
                  transcriptSegments: segments,
                  transcriptError: undefined,
                }
              : r
          ),
        }))
      } catch (err) {
        console.error('Transcription failed', err)
        const message = err instanceof Error ? err.message : 'Transcription failed'
        onUpdateSection(sectionId, (s) => ({
          ...s,
          recordings: (s.recordings ?? []).map((r) =>
            r.id === rec.id
              ? {
                  ...r,
                  transcriptionStatus: 'error',
                  transcriptError: message,
                }
              : r
          ),
        }))
      } finally {
        setTranscribingRecId((current) => (current === rec.id ? null : current))
      }
    },
    [onUpdateSection]
  )

  const formatTimestamp = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds))
    const m = Math.floor(s / 60)
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

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
                    <div className="ide-recording-meta">
                      {rec.duration != null && (
                        <span className="ide-recording-duration">{rec.duration}s</span>
                      )}
                      <button
                        type="button"
                        className="ide-recording-transcribe-btn"
                        onClick={() => handleTranscribeRecording(section.id, rec)}
                        disabled={transcribingRecId === rec.id}
                      >
                        {rec.transcriptionStatus === 'processing' || transcribingRecId === rec.id
                          ? `自動轉錄中… ${transcribingElapsedSeconds}s`
                          : rec.transcriptionStatus === 'done'
                            ? '重新轉錄'
                            : '自動轉錄'}
                      </button>
                    </div>
                    {rec.transcriptionStatus === 'error' && rec.transcriptError && (
                      <div className="ide-recording-transcript-error">
                        {rec.transcriptError}
                      </div>
                    )}
                    {rec.transcriptSegments && rec.transcriptSegments.length > 0 && (
                      <div className="ide-recording-transcript-preview">
                        <div className="ide-recording-transcript-scroll">
                          {rec.transcriptSegments.map((seg) => (
                            <div
                              key={`${seg.startSeconds}-${seg.endSeconds}-${rec.id}`}
                              className="ide-recording-transcript-row"
                            >
                              <span className="ide-recording-transcript-ts">
                                {formatTimestamp(seg.startSeconds)}–{formatTimestamp(seg.endSeconds)}
                              </span>
                              <span className="ide-recording-transcript-text">{seg.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
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
          {section.codeWindows && section.codeWindows.length > 0 && (
            <div className="ide-section-codewindows">
              <span className="ide-section-codewindows-label">Code render windows</span>
              <div className="ide-section-codewindows-list">
                {section.codeWindows.map((cw) => {
                  const isEditingCode = editingCodeWindowId === cw.id
                  return (
                    <div key={cw.id} className="ide-code-window-card">
                      <div className="ide-code-window-card-header">
                        <span className="ide-code-window-prompt-label">PROMPT</span>
                        {/* 1. Prompt (title) */}
                        <input
                          type="text"
                          className="ide-code-window-title"
                          value={cw.title ?? ''}
                          placeholder="標題（可選，例如：SVG 動畫、Mini game）"
                          onChange={(e) => {
                            const value = e.target.value
                            onUpdateSection(section.id, (s) => ({
                              ...s,
                              codeWindows: (s.codeWindows ?? []).map((w) =>
                                w.id === cw.id ? { ...w, title: value || undefined } : w
                              ),
                            }))
                          }}
                        />
                        {/* 2. Refresh button (forces iframe remount to restart animation) */}
                        <button
                          type="button"
                          className="ide-code-window-refresh"
                          title="重新整理預覽（重頭再播動畫）"
                          onClick={() => {
                            setRefreshNonceById((prev) => ({
                              ...prev,
                              [cw.id]: (prev[cw.id] ?? 0) + 1,
                            }))
                          }}
                        >
                          <svg
                            className="ide-code-window-refresh-icon"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path
                              d="M4.5 5.5A6 6 0 0 1 16 8h-2.5M16 8V4.5M15.5 14.5A6 6 0 0 1 4 12h2.5M4 12v3.5"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.6"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </button>
                        {/* 3. Model selector */}
                        <select
                          className="ide-code-window-model-select"
                          value={cw.model ?? 'gemini-3-pro'}
                          onChange={(e) => {
                            const value = e.target.value as SectionCodeWindow['model']
                            onUpdateSection(section.id, (s) => ({
                              ...s,
                              codeWindows: (s.codeWindows ?? []).map((w) =>
                                w.id === cw.id ? { ...w, model: value } : w,
                              ),
                            }))
                          }}
                        >
                          <option value="gemini-3-pro">Gemini 3 Pro</option>
                          <option value="gemini-3-flash">Gemini 3 Flash</option>
                        </select>
                        {/* 4. Generate button (inline Gemini call, independent from Agent) */}
                        <button
                          type="button"
                          className="ide-code-window-generate"
                          title="根據上面 PROMPT 生成 / 更新代碼"
                          disabled={!note || generatingCodeWindowId === cw.id}
                          onClick={() => {
                            if (!window || !('VITE_GEMINI_API_KEY' in import.meta.env)) {
                              // Fall back to key from Vite env; Canvas itself doesn't know the key directly.
                            }
                            if (!import.meta.env.VITE_GEMINI_API_KEY) {
                              console.error('未設定 Gemini API key，請先在 .env 填寫 VITE_GEMINI_API_KEY。')
                              return
                            }
                            setGeneratingCodeWindowId(cw.id)
                            generateCodeWindowSource({
                              apiKey: import.meta.env.VITE_GEMINI_API_KEY as string,
                              model: cw.model ?? 'gemini-3-pro',
                              language: cw.language,
                              userPrompt: cw.title ?? '',
                              sectionTitle: section.title,
                              windowTitle: cw.title,
                            })
                              .then((code) => {
                                onUpdateSection(section.id, (s) => ({
                                  ...s,
                                  codeWindows: (s.codeWindows ?? []).map((w) =>
                                    w.id === cw.id ? { ...w, source: code } : w,
                                  ),
                                }))
                              })
                              .catch((err) => {
                                const msg = err instanceof Error ? err.message : '生成代碼失敗，請稍後再試。'
                                console.error(msg)
                              })
                              .finally(() => {
                                setGeneratingCodeWindowId((current) => (current === cw.id ? null : current))
                              })
                          }}
                        >
                          {generatingCodeWindowId === cw.id ? (
                            <span className="ide-code-window-generate-spinner" aria-hidden="true" />
                          ) : (
                            <>
                              <svg
                                className="ide-code-window-generate-icon"
                                viewBox="0 0 20 20"
                                aria-hidden="true"
                              >
                                <path
                                  d="M3 10.5L8.5 16 17 4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span className="sr-only">Generate</span>
                            </>
                          )}
                        </button>
                        {/* 4. Aspect ratio selector */}
                        <select
                          className="ide-code-window-aspect-select"
                          value={cw.aspectRatio ?? '5:3'}
                          onChange={(e) => {
                            const value = e.target.value as SectionCodeWindow['aspectRatio']
                            onUpdateSection(section.id, (s) => ({
                              ...s,
                              codeWindows: (s.codeWindows ?? []).map((w) =>
                                w.id === cw.id ? { ...w, aspectRatio: value } : w
                              ),
                            }))
                          }}
                        >
                          <option value="1:1">1:1</option>
                          <option value="4:3">4:3</option>
                          <option value="16:9">16:9</option>
                          <option value="2:1">2:1</option>
                          <option value="5:3">5:3</option>
                        </select>
                        {/* 5. Choose HTML or React */}
                        <select
                          className="ide-code-window-language-select"
                          value={cw.language}
                          onChange={(e) => {
                            const lang = e.target.value as SectionCodeWindow['language']
                            onUpdateSection(section.id, (s) => ({
                              ...s,
                              codeWindows: (s.codeWindows ?? []).map((w) =>
                                w.id === cw.id ? { ...w, language: lang } : w
                              ),
                            }))
                          }}
                        >
                          <option value="html">HTML</option>
                          <option value="react">React (JSX)</option>
                        </select>
                        {/* 6. Edit / Preview toggle */}
                        <button
                          type="button"
                          className="ide-code-window-toggle"
                          onClick={() =>
                            setEditingCodeWindowId(isEditingCode ? null : cw.id)
                          }
                        >
                          {isEditingCode ? 'Preview' : 'Edit code'}
                        </button>
                        {/* 7. Delete code window (with global confirm dialog) */}
                        <button
                          type="button"
                          className="ide-code-window-delete"
                          onClick={() => {
                            if (onRequestDeleteCodeWindow) {
                              onRequestDeleteCodeWindow(section.id, cw.id)
                            } else {
                              onUpdateSection(section.id, (s) => ({
                                ...s,
                                codeWindows: (s.codeWindows ?? []).filter((w) => w.id !== cw.id),
                              }))
                              if (editingCodeWindowId === cw.id) {
                                setEditingCodeWindowId(null)
                              }
                            }
                          }}
                          title="刪除此 code window"
                          aria-label="刪除此 code window"
                        >
                          ×
                        </button>
                      </div>
                      <CodeRenderWindow
                        windowDef={cw}
                        aspectRatio={cw.aspectRatio}
                        // When refreshNonce changes, React will remount the iframe and restart any HTML/JS animations
                        key={refreshNonceById[cw.id] ?? 0}
                        isEditing={isEditingCode}
                        onChangeSource={(value) => {
                          onUpdateSection(section.id, (s) => ({
                            ...s,
                            codeWindows: (s.codeWindows ?? []).map((w) =>
                              w.id === cw.id ? { ...w, source: value } : w
                            ),
                          }))
                        }}
                      />
                    </div>
                  )
                })}
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
          <div className="ide-section-codewindows-actions">
            <button
              type="button"
              className="ide-code-window-add"
              onClick={() => {
                const id = `code-${Date.now()}-${Math.random().toString(36).slice(2)}`
                const initial: SectionCodeWindow = {
                  id,
                  language: 'html',
                  aspectRatio: '5:3',
                  title: '新 Code Window',
                  source: '<!-- 在此輸入 HTML / CSS / JS 小實驗，例如 SVG 或簡單動畫。-->',
                }
                onUpdateSection(section.id, (s) => ({
                  ...s,
                  codeWindows: [...(s.codeWindows ?? []), initial],
                }))
              }}
            >
              + 新增 Code Render Window
            </button>
          </div>
        </section>
      ))}
      <button type="button" className="ide-add-section" onClick={onAddSection}>
        + 加新章節
      </button>
    </div>
  )
}
