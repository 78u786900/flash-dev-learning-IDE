import { useMemo, useState, useRef, useEffect } from 'react'
import type { SectionCodeWindow } from '../types'

interface CodeRenderWindowProps {
  windowDef: SectionCodeWindow
  onChangeSource: (next: string) => void
}

/** Strip common markdown fences like ```html ... ``` or ```js ... ``` from model output. */
function stripMarkdownFence(raw: string): string {
  if (!raw) return raw
  let s = raw.trim()
  if (s.startsWith('```')) {
    // remove first line (``` or ```html)
    const firstNewline = s.indexOf('\n')
    if (firstNewline !== -1) {
      s = s.slice(firstNewline + 1)
    }
    // remove trailing ``` if present
    const lastFence = s.lastIndexOf('```')
    if (lastFence !== -1) {
      s = s.slice(0, lastFence)
    }
  }
  return s.trim()
}

/** Build srcDoc for an HTML snippet: we trust user content but keep it sandboxed in an iframe. */
function buildHtmlSrcDoc(source: string): string {
  const cleaned = stripMarkdownFence(source)
  if (!cleaned) {
    return '<!doctype html><html><body><p style="font-family:system-ui">（尚未輸入 HTML）</p></body></html>'
  }
  const lower = cleaned.toLowerCase()
  const hasHtmlShell = lower.includes('<html') || lower.includes('<!doctype')
  if (hasHtmlShell) return cleaned
  // Wrap fragment in minimal shell so even partial HTML 亦可渲染
  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8" /></head>',
    '<body>',
    cleaned,
    '</body>',
    '</html>',
  ].join('\n')
}

/** Build srcDoc for a React (JSX) snippet using CDN React + ReactDOM + Babel inside an isolated iframe. */
function buildReactSrcDoc(source: string): string {
  const base = stripMarkdownFence(source)
  const userCode = base?.trim()
    ? base
    : [
        '// 例子：一個簡單 React component',
        'function App() {',
        "  const [count, setCount] = React.useState(0);",
        '  return (',
        '    <div style={{ fontFamily: \"system-ui\", padding: 16 }}>',
        '      <h2>Code Render Window (React)</h2>',
        '      <p>呢個區塊會喺 iframe 入面以 React 渲染。</p>',
        '      <button onClick={() => setCount((c) => c + 1)}>點擊 +1：{count}</button>',
        '    </div>',
        '  );',
        '}',
        '',
        'const rootEl = document.getElementById(\"root\");',
        'const root = ReactDOM.createRoot(rootEl);',
        'root.render(<App />);',
      ].join('\n')

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <style>',
    '    html, body { margin: 0; padding: 0; height: 100%; }',
    '    body { background: #0b0c10; color: #e5e7eb; }',
    '    #root { height: 100%; }',
    '    * { box-sizing: border-box; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="root"></div>',
    '  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>',
    '  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>',
    '  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>',
    '  <script type="text/babel">',
    userCode,
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n')
}

export function CodeRenderWindow({ windowDef, onChangeSource }: CodeRenderWindowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [frameHeight, setFrameHeight] = useState(260)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const srcDoc = useMemo(() => {
    if (windowDef.language === 'react') {
      return buildReactSrcDoc(windowDef.source)
    }
    return buildHtmlSrcDoc(windowDef.source)
  }, [windowDef.language, windowDef.source])

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus()
      textAreaRef.current.setSelectionRange(textAreaRef.current.value.length, textAreaRef.current.value.length)
    }
  }, [isEditing])

  return (
    <div className={`ide-code-window ${isEditing ? 'ide-code-window--editing' : ''}`}>
      <div className="ide-code-window-header">
        <span className="ide-code-window-language">
          {windowDef.language === 'react' ? 'React (JSX)' : 'HTML'}
        </span>
        <button
          type="button"
          className="ide-code-window-toggle"
          onClick={() => setIsEditing(v => !v)}
        >
          {isEditing ? 'Preview' : 'Edit code'}
        </button>
      </div>
      {isEditing ? (
        <textarea
          ref={textAreaRef}
          className="ide-code-window-editor"
          value={windowDef.source}
          onChange={(e) => onChangeSource(e.target.value)}
          placeholder={
            windowDef.language === 'react'
              ? '輸入 React/JSX 代碼。例如定義一個 App component，最後用 ReactDOM.createRoot(...).render(<App />)。'
              : '輸入 HTML（可以包含 CSS / JS）用嚟製作小動畫，例如 SVG、Three.js、GSAP。'
          }
        />
      ) : (
        <div className="ide-code-window-frame-wrap">
          <iframe
            ref={iframeRef}
            className="ide-code-window-iframe"
            srcDoc={srcDoc}
            title={windowDef.title || 'Code render preview'}
            style={{ height: frameHeight }}
            onLoad={() => {
              const doc = iframeRef.current?.contentDocument
              const body = doc?.body
              if (body) {
                const scrollHeight = body.scrollHeight || 260
                const clamped = Math.max(200, Math.min(scrollHeight + 24, 720))
                setFrameHeight(clamped)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

