import { useState, useRef, useEffect } from 'react'
import type { AgentContext, ToolResultAction } from '../agent/types'
import { runAgentChatWithTools } from '../agent/geminiWithTools'
import { chatLogToTerminal } from '../agent/chatLog'
import type { StoredChatMessage } from '../storage/persistence'

export type ChatMode = 'agent' | 'ask'
export type GeminiModel = 'gemini-3-flash' | 'gemini-2.5-pro'

const MODELS: { id: GeminiModel; label: string; apiId: string }[] = [
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', apiId: 'gemini-2.0-flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', apiId: 'gemini-2.5-pro' },
]

const MOCK_AGENT_REPLY = `你好！我係 Learning IDE 嘅 AI Agent，我有以下工具可以用：
• **筆記**：整理口語成筆記、總結/擴寫 section、抽關鍵詞、出題、合併 section、建議結構
• **PDF**：總結頁、頁轉筆記、出問答題、抽定義

你可以話「將呢段整理成筆記」「總結第二章」「根據呢章出 3 條題」「呢頁變成我筆記嘅一節」等。試下喺左邊畫布揀好內容再同我講。`

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

async function callGeminiAsk(
  apiKey: string,
  modelApiId: string,
  messages: { role: 'user' | 'model'; text: string }[],
  userMessage: string,
  imageDataUrl?: string | null
): Promise<string> {
  const systemInstruction = 'You are a helpful assistant for Learning IDE. Reply concisely. Use Cantonese when appropriate.'
  const history: { role: 'user' | 'model'; parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] }[] = messages.map(m => ({ role: m.role as 'user' | 'model', parts: [{ text: m.text }] }))
  const lastParts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = []
  if (userMessage) lastParts.push({ text: userMessage })
  if (imageDataUrl) lastParts.push({ inline_data: { mime_type: 'image/png', data: dataUrlToBase64(imageDataUrl) } })
  if (lastParts.length === 0) lastParts.push({ text: '請睇呢張圖。' })
  history.push({ role: 'user' as const, parts: lastParts })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelApiId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: history,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `API error ${res.status}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  return text ?? '（無回覆）'
}

export interface AgentRunInfo {
  logs: string[]
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string; success: boolean }>
  error?: string
}

interface ChatPanelProps {
  agentContext?: AgentContext
  /** Persisted chat history (from App); controlled. */
  messages?: StoredChatMessage[]
  onMessagesChange?: (updater: (prev: StoredChatMessage[]) => StoredChatMessage[]) => void
  onToolAction?: (action: ToolResultAction) => void
  attachedImage?: string | null
  onClearAttached?: () => void
  /** Optional: multi-chat tabs */
  chatTabs?: { id: string; title: string }[]
  activeChatId?: string
  onSelectChat?: (id: string) => void
  onRequestDeleteChat?: (id: string) => void
  onNewChat?: () => void
}

export function ChatPanel({
  agentContext = {},
  messages: controlledMessages,
  onMessagesChange,
  onToolAction,
  attachedImage = null,
  onClearAttached,
  chatTabs,
  activeChatId,
  onSelectChat,
  onRequestDeleteChat,
  onNewChat,
}: ChatPanelProps) {
  const [mode, setMode] = useState<ChatMode>('agent')
  const [model, setModel] = useState<GeminiModel>('gemini-3-flash')
  const [input, setInput] = useState('')
  const [localMessages, setLocalMessages] = useState<StoredChatMessage[]>([{ role: 'agent', text: MOCK_AGENT_REPLY }])
  const messages = controlledMessages ?? localMessages
  const setMessages = onMessagesChange ?? setLocalMessages
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Live log lines while agent is running (Cursor-style real-time stream) */
  const [liveAgentRun, setLiveAgentRun] = useState<{ logs: string[] } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const liveRunEndRef = useRef<HTMLDivElement>(null)
  const tabsScrollRef = useRef<HTMLDivElement>(null)

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const hasApiKey = Boolean(apiKey?.trim())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (liveAgentRun?.logs?.length) liveRunEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveAgentRun?.logs?.length])

  // When number of chat tabs changes (e.g. new chat created), auto-scroll to the rightmost end
  useEffect(() => {
    if (!chatTabs || !chatTabs.length) return
    const el = tabsScrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [chatTabs?.length])

  const send = async () => {
    const text = input.trim()
    if (!text && !attachedImage) return
    setInput('')
    const displayText = text || '（附圖）'
    setMessages(prev => [...prev, { role: 'user', text: displayText }])
    chatLogToTerminal('user', { text: displayText })
    if (attachedImage) onClearAttached?.()
    setLoading(true)
    setError(null)
    try {
      if (!hasApiKey) {
        setMessages(prev => [...prev, { role: 'agent', text: '請喺 .env 設定 VITE_GEMINI_API_KEY 後先可以用 AI。' }])
        setLoading(false)
        return
      }
      const modelConfig = MODELS.find(m => m.id === model)
      const apiId = modelConfig?.apiId ?? 'gemini-2.0-flash'
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        text: m.text,
      }))
      if (mode === 'agent') {
        setLiveAgentRun({ logs: [] })
        const result = await runAgentChatWithTools({
          apiKey: apiKey!,
          modelApiId: apiId,
          messages: history,
          userMessage: text || '請睇呢張圖並回覆。',
          agentContext: { ...agentContext, imageUrl: attachedImage ?? undefined },
          onToolAction,
          onLog: (line) => {
            setLiveAgentRun(prev => prev ? { logs: [...prev.logs, line] } : null)
          },
          attachedImage: attachedImage ?? undefined,
        })
        setLiveAgentRun(null)
        chatLogToTerminal('agent', {
          text: result.text,
          logs: result.logs,
          toolCalls: result.toolCalls,
          error: result.error,
        })
        setMessages(prev => [...prev, {
          role: 'agent',
          text: result.error ? `出錯：${result.error}\n\n${result.text || ''}` : (result.text || '（無回覆）'),
          agentRun: {
            logs: result.logs ?? [],
            toolCalls: result.toolCalls,
            error: result.error,
          },
        }])
      } else {
        const reply = await callGeminiAsk(apiKey!, apiId, history, text || '請睇呢張圖。', attachedImage)
        chatLogToTerminal('agent', { text: reply })
        setMessages(prev => [...prev, { role: 'agent', text: reply }])
      }
    } catch (e) {
      setLiveAgentRun(null)
      const errMsg = e instanceof Error ? e.message : String(e)
      const isFetchFailed = /failed to fetch|network|networkerror/i.test(errMsg)
      const hint = isFetchFailed
        ? '\n\n可能原因：網絡唔通、API key 無設好、或者被防火牆/擴展擋咗。請檢查 .env 嘅 VITE_GEMINI_API_KEY，同確保可以連到 Google API。'
        : ''
      setError(errMsg)
      setMessages(prev => [...prev, { role: 'agent', text: `出錯：${errMsg}${hint}` }])
    } finally {
      setLoading(false)
    }
  }

  /** Render Cursor-style agent run block (live or completed) */
  const renderAgentRunBlock = (run: { logs: string[]; toolCalls?: AgentRunInfo['toolCalls']; error?: string }, isLive?: boolean) => {
    const hasToolCalls = run.toolCalls && run.toolCalls.length > 0
    return (
      <div className={`ide-chat-agent-run ${isLive ? 'ide-chat-agent-run--live' : ''}`}>
        <div className="ide-chat-agent-run-header">
          <span className="ide-chat-agent-run-dot" />
          {isLive ? 'Agent running…' : 'Agent run'}
        </div>
        <div className="ide-chat-agent-run-steps">
          {hasToolCalls && !isLive
            ? run.toolCalls!.map((tc, idx) => (
                <div key={idx} className="ide-chat-agent-step-group">
                  <div className="ide-chat-agent-step ide-chat-agent-step--tool">
                    <span className="ide-chat-agent-step-name">{tc.name}</span>
                    <span className="ide-chat-agent-step-args">
                      {Object.keys(tc.args).length ? JSON.stringify(tc.args) : '()'}
                    </span>
                  </div>
                  <div className={`ide-chat-agent-step ide-chat-agent-step--result ${tc.success ? 'ide-chat-agent-step--ok' : 'ide-chat-agent-step--error'}`}>
                    {tc.success ? '✓' : '✗'} {tc.result.slice(0, 200)}{tc.result.length > 200 ? '…' : ''}
                  </div>
                </div>
              ))
            : run.logs.map((line, idx) => {
                const layer = /^\[Layer\]\s*(.+)$/.exec(line)
                const skill = /^\[Skill\]\s*(.+)$/.exec(line)
                const toolCall = /^\[Tool\]\s*(.+)$/.exec(line)
                const toolResult = /^\[Tool\]\s*\w+\s*→\s*(ok|error):\s*(.+)$/.exec(line)
                let stepClass = 'ide-chat-agent-step--log'
                if (layer) stepClass = 'ide-chat-agent-step--layer'
                else if (skill) stepClass = 'ide-chat-agent-step--skill'
                else if (toolResult) stepClass = toolResult[1] === 'ok' ? 'ide-chat-agent-step--ok' : 'ide-chat-agent-step--error'
                else if (toolCall) stepClass = 'ide-chat-agent-step--tool'
                return (
                  <div key={idx} className={`ide-chat-agent-step ${stepClass}`}>
                    {line}
                  </div>
                )
              })}
        </div>
        {run.error && !isLive && (
          <div className="ide-chat-agent-run-error">{run.error}</div>
        )}
      </div>
    )
  }

  return (
    <div className="ide-chat">
      {chatTabs && chatTabs.length > 0 && (
        <div className="ide-chat-tabs">
          <div className="ide-chat-tabs-scroll" ref={tabsScrollRef}>
            {chatTabs.map((tab) => (
              <div
                key={tab.id}
                className={
                  'ide-chat-tab-wrap' +
                  (tab.id === activeChatId ? ' ide-chat-tab--active' : '')
                }
              >
                <button
                  type="button"
                  className="ide-chat-tab"
                  onClick={() => onSelectChat?.(tab.id)}
                >
                  {tab.title}
                </button>
                {onRequestDeleteChat && (
                  <button
                    type="button"
                    className="ide-chat-tab-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRequestDeleteChat(tab.id)
                    }}
                    title="刪除對話"
                    aria-label="刪除對話"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ide-chat-tab ide-chat-tab--new"
            onClick={() => onNewChat?.()}
          >
            ＋ 新對話
          </button>
        </div>
      )}
      <div className="ide-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ide-chat-msg ${msg.role}`}>
            {msg.role === 'agent' && msg.agentRun && (msg.agentRun.logs.length > 0 || (msg.agentRun.toolCalls?.length ?? 0) > 0) && renderAgentRunBlock(msg.agentRun)}
            <div className={msg.agentRun ? 'ide-chat-agent-reply' : ''}>{msg.text}</div>
          </div>
        ))}
        {loading && mode === 'agent' && (
          <div className="ide-chat-msg agent ide-chat-msg--agent-run">
            {liveAgentRun ? renderAgentRunBlock(liveAgentRun, true) : <div className="ide-chat-loading">思考中…</div>}
            <div ref={liveRunEndRef} />
          </div>
        )}
        {loading && mode !== 'agent' && (
          <div className="ide-chat-msg agent ide-chat-loading">思考中…</div>
        )}
        {error && (
          <div className="ide-chat-error">{error}</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="ide-chat-input-wrap">
        {attachedImage && (
          <div className="ide-chat-attached">
            <img src={attachedImage} alt="框選區域" className="ide-chat-attached-img" />
            <button type="button" className="ide-chat-attached-remove" onClick={onClearAttached} title="移除">
              ×
            </button>
          </div>
        )}
        <textarea
          className="ide-chat-input"
          placeholder={attachedImage ? '可加文字再送俾 AI…' : (mode === 'agent' ? 'Plan, @ for context, / for commands' : '問我任何嘢…')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          disabled={loading}
        />
        <div className="ide-chatbar">
          <select
            className="ide-chatbar-select ide-chatbar-mode"
            value={mode}
            onChange={e => setMode(e.target.value as ChatMode)}
            title="模式"
          >
            <option value="ask">Ask</option>
            <option value="agent">∞ Agent</option>
          </select>
          <select
            className="ide-chatbar-select ide-chatbar-model"
            value={model}
            onChange={e => setModel(e.target.value as GeminiModel)}
            title="AI 模型"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="ide-chatbar-send"
            onClick={send}
            disabled={loading}
            title={attachedImage ? '發送附圖' : '發送'}
            aria-label="發送"
          >
            {loading ? (
              <span className="ide-chatbar-send-spinner" aria-hidden />
            ) : (
              <span className="ide-chatbar-send-icon">→</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
