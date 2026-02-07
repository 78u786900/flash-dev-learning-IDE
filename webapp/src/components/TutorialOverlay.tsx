/**
 * TutorialOverlay — Self-contained 2D animated IDE tutorial popup.
 * Completely independent from any other component or app state.
 * Shows a miniature IDE mockup with an animated cursor walking through features.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

/* ─── Step Data ─────────────────────────────────────────────── */

interface TutorialStep {
  title: string
  titleZh: string
  desc: string
  /** Which IDE region to highlight */
  area: 'all' | 'sidebar' | 'notes' | 'files' | 'canvas' | 'chat' | 'header' | 'status'
  /** Cursor position as percentage within the IDE mockup */
  cursor: { x: number; y: number }
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Learning IDE',
    titleZh: '歡迎使用 Learning IDE',
    desc: 'Your AI-powered learning workspace, designed for students. Let\u2019s take a quick tour.',
    area: 'all',
    cursor: { x: 50, y: 50 },
  },
  {
    title: 'Sidebar \u2014 Your Workspace',
    titleZh: '側邊欄 \u2014 工作空間',
    desc: 'Manage all your notes, uploaded files, and see your activity timeline here.',
    area: 'sidebar',
    cursor: { x: 11, y: 50 },
  },
  {
    title: 'Notes & Sections',
    titleZh: '筆記同章節',
    desc: 'Create structured notes with chapters. Each section supports LaTeX math like $E=mc^2$.',
    area: 'notes',
    cursor: { x: 11, y: 35 },
  },
  {
    title: 'Files & Media',
    titleZh: '檔案管理',
    desc: 'Drag & drop PDFs, images, videos, and documents. Preview them instantly in the canvas.',
    area: 'files',
    cursor: { x: 11, y: 65 },
  },
  {
    title: 'Canvas \u2014 Your Editor',
    titleZh: '畫布編輯器',
    desc: 'Edit notes with rich LaTeX rendering, view PDFs page by page, or preview media files. Add overlays and memos.',
    area: 'canvas',
    cursor: { x: 46, y: 50 },
  },
  {
    title: 'AI Agent Chat',
    titleZh: 'AI 助手',
    desc: 'Gemini-powered AI agent. Summarize pages, generate quizzes, convert PDF to notes, search across your workspace\u2014all by chatting.',
    area: 'chat',
    cursor: { x: 85, y: 50 },
  },
  {
    title: 'Smart Tools',
    titleZh: '工具列',
    desc: 'Command palette (Ctrl+P), Pomodoro timer, undo/redo, fullscreen focus mode, and API key management.',
    area: 'header',
    cursor: { x: 50, y: 6 },
  },
  {
    title: 'Ready to Learn!',
    titleZh: '準備好開始學習！',
    desc: 'Click anywhere outside this window, or press Escape, to start using the IDE. 加油！',
    area: 'all',
    cursor: { x: 50, y: 50 },
  },
]

const AUTO_ADVANCE_MS = 5000

/* ─── Keyframe CSS (injected once) ──────────────────────────── */

const KEYFRAMES_CSS = `
@keyframes tut-fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes tut-slideUp {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes tut-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); }
  50%      { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
}
@keyframes tut-cursorGlow {
  0%, 100% { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
  50%      { transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
}
@keyframes tut-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
@keyframes tut-typing {
  from { width: 0; }
  to   { width: 60%; }
}
`

/* ─── Component ─────────────────────────────────────────────── */

export function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [entering, setEntering] = useState(true)
  const [textFade, setTextFade] = useState(true)
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoPaused, setAutoPaused] = useState(false)

  /* Fade in on mount */
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50)
    return () => clearTimeout(t)
  }, [])

  /* Text fade on step change */
  useEffect(() => {
    setTextFade(false)
    const t = setTimeout(() => setTextFade(true), 60)
    return () => clearTimeout(t)
  }, [step])

  /* Auto-advance */
  useEffect(() => {
    if (autoPaused) return
    autoRef.current = setTimeout(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s))
    }, AUTO_ADVANCE_MS)
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current)
    }
  }, [step, autoPaused])

  /* Keyboard navigation */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setAutoPaused(true)
        setStep((s) => Math.min(s + 1, STEPS.length - 1))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setAutoPaused(true)
        setStep((s) => Math.max(s - 1, 0))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const goNext = useCallback(() => {
    setAutoPaused(true)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }, [])
  const goPrev = useCallback(() => {
    setAutoPaused(true)
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  /* ── Region highlight helpers ── */
  const isActive = (region: string) =>
    current.area === 'all' || current.area === region

  const dimStyle = (region: string): React.CSSProperties => ({
    opacity: isActive(region) ? 1 : 0.25,
    transition: 'opacity 0.6s ease, box-shadow 0.6s ease',
    ...(isActive(region) && current.area !== 'all'
      ? { boxShadow: '0 0 0 2px rgba(99,102,241,0.6)', animation: 'tut-pulse 2s infinite' }
      : {}),
  })

  /* ── Render ── */
  return (
    <>
      <style>{KEYFRAMES_CSS}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'tut-fadeIn 0.4s ease both',
          opacity: entering ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* Popup card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '92vw',
            maxWidth: 720,
            background: 'linear-gradient(170deg, #1a1a2e 0%, #16162a 100%)',
            borderRadius: 16,
            border: '1px solid rgba(99,102,241,0.25)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
            overflow: 'hidden',
            animation: 'tut-slideUp 0.5s ease both',
            animationDelay: '0.15s',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              zIndex: 10,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: 18,
              lineHeight: 1,
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.color = '#e2e8f0'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = '#94a3b8'
            }}
            aria-label="Close tutorial"
          >
            ✕
          </button>

          {/* ─── Mini IDE Mockup ─── */}
          <div
            style={{
              position: 'relative',
              margin: '24px 24px 0',
              height: 300,
              borderRadius: 10,
              overflow: 'hidden',
              background: '#12121f',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* HEADER BAR */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 32,
                background: '#1e1e34',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 8,
                borderRadius: '10px 10px 0 0',
                ...dimStyle('header'),
              }}
            >
              {/* Window dots */}
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div style={{ flex: 1 }} />
              {/* Fake buttons */}
              <div style={{ width: 40, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ width: 28, height: 14, borderRadius: 4, background: 'rgba(99,102,241,0.25)' }} />
              <div style={{ width: 50, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* MAIN AREA (below header, above status bar) */}
            <div style={{ position: 'absolute', top: 32, left: 0, right: 0, bottom: 22, display: 'flex' }}>
              {/* SIDEBAR */}
              <div
                style={{
                  width: '22%',
                  background: '#17172b',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  overflow: 'hidden',
                  ...dimStyle('sidebar'),
                  ...(current.area === 'notes' || current.area === 'files'
                    ? { opacity: 1, boxShadow: 'none', animation: 'none' }
                    : {}),
                }}
              >
                {/* NOTES section */}
                <div style={dimStyle('notes')}>
                  <div style={{ fontSize: 7, color: '#64748b', letterSpacing: 1, marginBottom: 4, fontFamily: 'system-ui' }}>
                    NOTES
                  </div>
                  {['My First Note', 'Chapter 1 Summary', 'Math Revision'].map((name, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 4px',
                        borderRadius: 3,
                        background: i === 0 ? 'rgba(99,102,241,0.15)' : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: i === 0 ? '#6366f1' : '#475569',
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 7,
                          color: i === 0 ? '#c7d2fe' : '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontFamily: 'system-ui',
                        }}
                      >
                        {name}
                      </div>
                    </div>
                  ))}
                </div>

                {/* FILES section */}
                <div style={{ marginTop: 6, ...dimStyle('files') }}>
                  <div style={{ fontSize: 7, color: '#64748b', letterSpacing: 1, marginBottom: 4, fontFamily: 'system-ui' }}>
                    FILES
                  </div>
                  {['lecture.pdf', 'diagram.png'].map((name, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 4px' }}>
                      <div style={{ fontSize: 8, opacity: 0.5 }}>{i === 0 ? '📄' : '🖼'}</div>
                      <div style={{ fontSize: 7, color: '#64748b', fontFamily: 'system-ui' }}>{name}</div>
                    </div>
                  ))}
                </div>

                {/* TIMELINE section */}
                <div style={{ marginTop: 6, opacity: 0.5 }}>
                  <div style={{ fontSize: 7, color: '#64748b', letterSpacing: 1, marginBottom: 4, fontFamily: 'system-ui' }}>
                    TIMELINE
                  </div>
                  {['Created note', 'Opened PDF'].map((label, i) => (
                    <div key={i} style={{ fontSize: 6, color: '#475569', padding: '2px 4px', fontFamily: 'system-ui' }}>
                      • {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* CANVAS */}
              <div
                style={{
                  flex: 1,
                  background: '#12121f',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  overflow: 'hidden',
                  ...dimStyle('canvas'),
                }}
              >
                {/* Note title */}
                <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, fontFamily: 'system-ui' }}>
                  My First Note
                </div>
                {/* Section title */}
                <div style={{ fontSize: 8, color: '#6366f1', fontFamily: 'system-ui', marginTop: 2 }}>
                  § 第一章：入門
                </div>
                {/* Content lines (fake) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  <div style={{ width: '90%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ width: '75%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ width: '85%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ width: '60%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }} />
                </div>
                {/* LaTeX mockup */}
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'rgba(99,102,241,0.07)',
                    borderRadius: 6,
                    border: '1px solid rgba(99,102,241,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, color: '#c7d2fe', fontFamily: 'serif', fontStyle: 'italic' }}>
                    E = mc²
                  </span>
                  <span style={{ fontSize: 7, color: '#6366f1', fontFamily: 'system-ui' }}>LaTeX</span>
                </div>
                {/* More lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                  <div style={{ width: '70%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ width: '80%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                </div>
                {/* Section 2 */}
                <div style={{ fontSize: 8, color: '#6366f1', fontFamily: 'system-ui', marginTop: 10 }}>
                  § 第二章：練習
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  <div style={{ width: '65%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ width: '50%', height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                </div>
              </div>

              {/* CHAT PANEL */}
              <div
                style={{
                  width: '28%',
                  background: '#17172b',
                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  ...dimStyle('chat'),
                }}
              >
                {/* Chat header */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 7,
                      color: '#6366f1',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(99,102,241,0.15)',
                      fontFamily: 'system-ui',
                    }}
                  >
                    Agent
                  </div>
                  <div
                    style={{
                      fontSize: 7,
                      color: '#64748b',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontFamily: 'system-ui',
                    }}
                  >
                    Ask
                  </div>
                </div>

                {/* Agent message */}
                <div
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    borderRadius: '8px 8px 8px 2px',
                    padding: '6px 8px',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 6, color: '#6366f1', marginBottom: 3, fontFamily: 'system-ui' }}>AI Agent</div>
                  <div style={{ fontSize: 7, color: '#94a3b8', lineHeight: 1.4, fontFamily: 'system-ui' }}>
                    你好！我可以幫你整理筆記、總結 PDF、出題…
                  </div>
                </div>

                {/* User message */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '8px 8px 2px 8px',
                    padding: '6px 8px',
                    marginBottom: 6,
                    alignSelf: 'flex-end',
                    maxWidth: '85%',
                  }}
                >
                  <div style={{ fontSize: 7, color: '#c7d2fe', lineHeight: 1.4, fontFamily: 'system-ui' }}>
                    幫我總結第一頁
                  </div>
                </div>

                {/* Agent thinking indicator */}
                <div
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    borderRadius: '8px 8px 8px 2px',
                    padding: '6px 8px',
                    display: 'flex',
                    gap: 3,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#6366f1',
                      animation: 'tut-blink 1.2s infinite',
                    }}
                  />
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#6366f1',
                      animation: 'tut-blink 1.2s 0.2s infinite',
                    }}
                  />
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#6366f1',
                      animation: 'tut-blink 1.2s 0.4s infinite',
                    }}
                  />
                </div>

                <div style={{ flex: 1 }} />

                {/* Input bar */}
                <div
                  style={{
                    height: 22,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                  }}
                >
                  <div style={{ fontSize: 7, color: '#475569', fontFamily: 'system-ui' }}>Type a message…</div>
                </div>
              </div>
            </div>

            {/* STATUS BAR */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 22,
                background: '#1e1e34',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 12,
                borderRadius: '0 0 10px 10px',
                ...dimStyle('status'),
              }}
            >
              <div style={{ fontSize: 7, color: '#6366f1', fontFamily: 'system-ui' }}>learning_IDE</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 7, color: '#475569', fontFamily: 'system-ui' }}>Progress: 50%</div>
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '50%', height: '100%', borderRadius: 2, background: '#6366f1' }} />
              </div>
            </div>

            {/* ─── Animated Cursor ─── */}
            <div
              style={{
                position: 'absolute',
                left: `${current.cursor.x}%`,
                top: `${current.cursor.y}%`,
                zIndex: 20,
                pointerEvents: 'none',
                transition: 'left 0.8s cubic-bezier(0.4,0,0.2,1), top 0.8s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {/* Glow ring */}
              <div
                style={{
                  position: 'absolute',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '2px solid rgba(99,102,241,0.5)',
                  animation: 'tut-cursorGlow 2s ease-in-out infinite',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* Core dot */}
              <div
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#6366f1',
                  boxShadow: '0 0 12px 3px rgba(99,102,241,0.5)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* Cursor arrow SVG */}
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 3,
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
                }}
              >
                <path
                  d="M1 1L1 15L5 11L9 19L12 17.5L8 10L13 9L1 1Z"
                  fill="white"
                  stroke="#1e1e2e"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
          </div>

          {/* ─── Step Text ─── */}
          <div
            style={{
              padding: '20px 28px 8px',
              opacity: textFade ? 1 : 0,
              transition: 'opacity 0.35s ease',
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#e2e8f0',
                lineHeight: 1.3,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {current.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#6366f1',
                marginTop: 2,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {current.titleZh}
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#94a3b8',
                marginTop: 8,
                lineHeight: 1.6,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {current.desc}
            </div>
          </div>

          {/* ─── Navigation ─── */}
          <div
            style={{
              padding: '12px 28px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Prev button */}
            <button
              onClick={goPrev}
              disabled={step === 0}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                width: 36,
                height: 36,
                cursor: step === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: step === 0 ? '#334155' : '#94a3b8',
                fontSize: 16,
                transition: 'all 0.2s',
                opacity: step === 0 ? 0.4 : 1,
              }}
              aria-label="Previous step"
            >
              ‹
            </button>

            {/* Step dots */}
            <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setAutoPaused(true); setStep(i) }}
                  style={{
                    width: step === i ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: step === i ? '#6366f1' : 'rgba(255,255,255,0.12)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.35s ease',
                  }}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Next / Close button */}
            <button
              onClick={isLast ? onClose : goNext}
              style={{
                background: isLast
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : 'rgba(255,255,255,0.06)',
                border: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                height: 36,
                padding: '0 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isLast ? '#fff' : '#94a3b8',
                fontSize: 13,
                fontWeight: isLast ? 600 : 400,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                transition: 'all 0.2s',
                gap: 6,
                minWidth: 36,
              }}
              aria-label={isLast ? 'Start using IDE' : 'Next step'}
            >
              {isLast ? 'Start' : '›'}
            </button>
          </div>

          {/* Step counter */}
          <div
            style={{
              textAlign: 'center',
              paddingBottom: 16,
              fontSize: 11,
              color: '#475569',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {step + 1} / {STEPS.length} · {autoPaused ? 'Manual' : 'Auto-playing'} · Press ← → or Esc
          </div>
        </div>
      </div>
    </>
  )
}
