import type { CodeWindowLanguage, CodeWindowModel } from '../types'

const MODEL_MAP: Record<CodeWindowModel, string> = {
  'gemini-3-pro': 'gemini-3-pro-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
}

export type GeminiInlineModel = CodeWindowModel

export interface InlineCodeGenParams {
  apiKey: string
  model: GeminiInlineModel
  language: CodeWindowLanguage
  userPrompt: string
  sectionTitle?: string
  windowTitle?: string
}

export async function generateCodeWindowSource({
  apiKey,
  model,
  language,
  userPrompt,
  sectionTitle,
  windowTitle,
}: InlineCodeGenParams): Promise<string> {
  const trimmed = userPrompt.trim()
  if (!trimmed) {
    throw new Error('請先輸入 PROMPT，再按 Generate。')
  }

  const modelId = MODEL_MAP[model] ?? MODEL_MAP['gemini-3-pro']

  const systemHint =
    language === 'react'
      ? `你而家要幫用戶生成一段 **React/JSX 代碼**，用嚟示範一個細型互動 demo（例如小遊戲、控件、動畫 component）。代碼會放喺一個「Code Window」入面，用 React 18 + ReactDOM.createRoot 以 UMD 方式執行。`
      : `你而家要幫用戶生成一個 **單一 HTML 檔**，用嚟示範一個細型互動 demo（例如 SVG 動畫、Canvas、簡單 3D、CSS 動畫）。代碼會放喺一個「Code Window」入面，以 iframe 方式顯示。`

  const uiContext = [
    sectionTitle ? `所屬章節標題：${sectionTitle}` : null,
    windowTitle ? `Code Window 標題：${windowTitle}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const instructions =
    language === 'react'
      ? `請根據以下 PROMPT，輸出一份完整 React/JSX source code：

- 使用全域變數 React / ReactDOM（React 18 UMD），代碼會被放入 <script type="text/babel"> 內。
- 建議建立一個 App component，最後用：
  const rootEl = document.getElementById("root");
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
- 風格現代簡潔，適合教學示範，避免過長或太複雜。
- **只輸出代碼本身**，唔好加多餘解釋、唔好用 markdown、唔好加 \`\`\`。`
      : `請根據以下 PROMPT，輸出一份完整 HTML 檔：

- 包括 <!doctype html>、<html>、<head>、<body>。
- 可以用 CSS、JavaScript、SVG、Canvas 或 Three.js（用 CDN <script src="..."></script>；唔好用 import/bundler）。
- Layout 以 Code Window 預覽為主，唔需要整網站 navigation。
- **只輸出 HTML 代碼本身**，唔好加多餘解釋、唔好用 markdown、唔好加 \`\`\`。`

  const fullPrompt = [
    systemHint,
    uiContext && `\n[UI context]\n${uiContext}`,
    '\n[用戶 PROMPT]\n',
    trimmed,
    '\n[具體輸出要求]\n',
    instructions,
  ]
    .filter(Boolean)
    .join('\n')

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ],
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini API error (${res.status}): ${text || res.statusText}`)
  }

  const json = (await res.json()) as any
  const candidates = json.candidates as any[] | undefined
  const text = candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
  if (!text || typeof text !== 'string') {
    throw new Error('Gemini API 沒有返回任何代碼，請稍後再試。')
  }
  return text.trim()
}

