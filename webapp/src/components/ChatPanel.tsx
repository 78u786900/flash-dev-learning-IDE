import { useState, useRef, useEffect, useCallback } from 'react'
import type { AgentContext, ToolResultAction } from '../agent/types'
import { runAgentChatWithTools, type RenderError } from '../agent/geminiWithTools'
import { chatLogToTerminal } from '../agent/chatLog'
import type { StoredChatMessage, AgentStep, AgentStepType } from '../storage/persistence'
import type { RenderErrorWithContext } from './Canvas'

const MAX_IMAGE_DATAURL_LENGTH = 800 * 1024 // ~800KB; skip storing if larger to avoid localStorage quota

export type ChatMode = 'agent' | 'ask'

export type ApiProvider = 'google' | 'openai' | 'anthropic'

export type ChatModelId =
  | 'gemini-3-pro' | 'gemini-3-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite'
  | 'gpt-5.2-pro' | 'gpt-5.2' | 'gpt-5-mini' | 'gpt-4.1' | 'gpt-4.1-mini'
  | 'claude-opus-4.6' | 'claude-opus-4.5' | 'claude-sonnet-4.5' | 'claude-haiku-4.5' | 'claude-sonnet-3.5'

interface ModelDef {
  id: ChatModelId
  label: string
  apiId: string
  provider: ApiProvider
}

const MODELS: ModelDef[] = [
  // Google (Gemini)
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', apiId: 'gemini-3-pro-preview', provider: 'google' },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', apiId: 'gemini-3-flash-preview', provider: 'google' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', apiId: 'gemini-2.5-pro', provider: 'google' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', apiId: 'gemini-2.5-flash', provider: 'google' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', apiId: 'gemini-2.5-flash-lite', provider: 'google' },
  // OpenAI
  { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', apiId: 'gpt-5.2-pro', provider: 'openai' },
  { id: 'gpt-5.2', label: 'GPT-5.2', apiId: 'gpt-5.2', provider: 'openai' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini', apiId: 'gpt-5-mini', provider: 'openai' },
  { id: 'gpt-4.1', label: 'GPT-4.1', apiId: 'gpt-4.1', provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', apiId: 'gpt-4.1-mini', provider: 'openai' },
  // Anthropic (Claude)
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', apiId: 'claude-opus-4-6-20260205', provider: 'anthropic' },
  { id: 'claude-opus-4.5', label: 'Claude Opus 4.5', apiId: 'claude-opus-4-5-20250520', provider: 'anthropic' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', apiId: 'claude-sonnet-4-5-20241022', provider: 'anthropic' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', apiId: 'claude-haiku-4-5-20241022', provider: 'anthropic' },
  { id: 'claude-sonnet-3.5', label: 'Claude Sonnet 3.5', apiId: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
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

async function callOpenAIAsk(
  apiKey: string,
  modelApiId: string,
  messages: { role: 'user' | 'model'; text: string }[],
  userMessage: string,
  imageDataUrl?: string | null
): Promise<string> {
  const systemMsg = 'You are a helpful assistant for Learning IDE. Reply concisely. Use Cantonese when appropriate.'
  const openaiMessages: { role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; image_url?: { url: string }; text?: string }> }[] = [
    { role: 'system', content: systemMsg },
  ]
  for (const m of messages) {
    if (m.role === 'user') {
      openaiMessages.push({ role: 'user', content: m.text })
    } else {
      openaiMessages.push({ role: 'assistant', content: m.text })
    }
  }
  const lastContent: Array<{ type: string; image_url?: { url: string }; text?: string }> = []
  if (userMessage) lastContent.push({ type: 'text', text: userMessage })
  if (imageDataUrl) lastContent.push({ type: 'image_url', image_url: { url: imageDataUrl } })
  if (lastContent.length === 0) lastContent.push({ type: 'text', text: '請睇呢張圖。' })
  openaiMessages.push({ role: 'user', content: lastContent })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelApiId,
      messages: openaiMessages,
      max_tokens: 4096,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `OpenAI API error ${res.status}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  return text?.trim() ?? '（無回覆）'
}

async function callAnthropicAsk(
  apiKey: string,
  modelApiId: string,
  messages: { role: 'user' | 'model'; text: string }[],
  userMessage: string,
  imageDataUrl?: string | null
): Promise<string> {
  const systemPrompt = 'You are a helpful assistant for Learning IDE. Reply concisely. Use Cantonese when appropriate.'
  const anthropicMessages: { role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> }[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      anthropicMessages.push({ role: 'user', content: [{ type: 'text', text: m.text }] })
    } else {
      anthropicMessages.push({ role: 'assistant', content: [{ type: 'text', text: m.text }] })
    }
  }
  const lastContent: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> = []
  if (userMessage) lastContent.push({ type: 'text', text: userMessage })
  if (imageDataUrl) {
    const base64 = dataUrlToBase64(imageDataUrl)
    const mime = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    lastContent.push({ type: 'image', source: { type: 'base64', media_type: mime, data: base64 } })
  }
  if (lastContent.length === 0) lastContent.push({ type: 'text', text: '請睇呢張圖。' })
  anthropicMessages.push({ role: 'user', content: lastContent })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelApiId,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Anthropic API error ${res.status}`)
  }
  const data = await res.json()
  const text = data?.content?.[0]?.text
  return text?.trim() ?? '（無回覆）'
}

export interface AgentRunInfo {
  logs: string[]
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string; success: boolean }>
  error?: string
  thinkingDuration?: number
  startedAt?: number
  /** Parsed steps for linear display */
  steps?: AgentStep[]
}

/** Parse a log line into a step */
function parseLogToStep(line: string, id: string): AgentStep {
  const ts = Date.now()
  
  // [Thinking] ...
  const thinkingMatch = /^\[Thinking\]\s*(.+)$/s.exec(line)
  if (thinkingMatch) {
    return { id, type: 'thinking', content: thinkingMatch[1], ts }
  }
  
  // [Tool] toolName(...) or [Tool] toolName → ok/error: ...
  const toolCallMatch = /^\[Tool\]\s*(\w+)\s*\(([^)]*)\)/.exec(line)
  if (toolCallMatch) {
    return { id, type: 'tool_call', content: line.replace(/^\[Tool\]\s*/, ''), toolName: toolCallMatch[1], ts }
  }
  
  const toolResultMatch = /^\[Tool\]\s*(\w+)\s*→\s*(ok|error):\s*(.+)$/s.exec(line)
  if (toolResultMatch) {
    return { id, type: 'tool_result', content: toolResultMatch[3], toolName: toolResultMatch[1], success: toolResultMatch[2] === 'ok', ts }
  }
  
  // [Layer] ...
  const layerMatch = /^\[Layer\]\s*(.+)$/.exec(line)
  if (layerMatch) {
    return { id, type: 'layer', content: layerMatch[1], ts }
  }
  
  // [Skill] ...
  const skillMatch = /^\[Skill\]\s*(.+)$/.exec(line)
  if (skillMatch) {
    return { id, type: 'skill', content: skillMatch[1], ts }
  }
  
  // [Model] ...
  const modelMatch = /^\[Model\]\s*(.+)$/.exec(line)
  if (modelMatch) {
    return { id, type: 'model', content: modelMatch[1], ts }
  }
  
  // Default: log
  return { id, type: 'log', content: line, ts }
}

interface ChatPanelProps {
  agentContext?: AgentContext
  /** API keys per provider (from user-stored + env fallback for Google). */
  storedApiKeys?: Record<ApiProvider, string>
  /** Fallback Gemini key from env (used when storedApiKeys.google is empty). */
  geminiApiKeyEnv?: string
  messages?: StoredChatMessage[]
  onMessagesChange?: (updater: (prev: StoredChatMessage[]) => StoredChatMessage[]) => void
  onToolAction?: (action: ToolResultAction) => void
  attachedImage?: string | null
  onClearAttached?: () => void
  chatTabs?: { id: string; title: string }[]
  activeChatId?: string
  onSelectChat?: (id: string) => void
  onRequestDeleteChat?: (id: string) => void
  onNewChat?: () => void
  pendingRenderErrors?: RenderErrorWithContext[]
  onClearRenderErrors?: () => void
}

export function ChatPanel({
  agentContext = {},
  storedApiKeys = { google: '', openai: '', anthropic: '' },
  geminiApiKeyEnv,
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
  pendingRenderErrors,
  onClearRenderErrors,
}: ChatPanelProps) {
  const [mode, setMode] = useState<ChatMode>('agent')
  const [model, setModel] = useState<ChatModelId>('gemini-3-flash')
  const [input, setInput] = useState('')
  const [localMessages, setLocalMessages] = useState<StoredChatMessage[]>([{ role: 'agent', text: MOCK_AGENT_REPLY }])
  const messages = controlledMessages ?? localMessages
  const setMessages = onMessagesChange ?? setLocalMessages
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  /** Live steps while agent is running - displayed inline */
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([])
  /** Live streaming text (for current thinking/reply) */
  const [streamingText, setStreamingText] = useState<{ text: string; isThinking: boolean } | null>(null)
  /** Which step IDs are expanded (collapsed by default after new step) */
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  /** Current live step ID (always expanded) */
  const [currentLiveStepId, setCurrentLiveStepId] = useState<string | null>(null)
  /** Run start time for duration display */
  const [runStartTime, setRunStartTime] = useState<number | null>(null)
  /** Elapsed time */
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState<'mode' | 'model' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatbarRef = useRef<HTMLDivElement>(null)
  const tabsScrollRef = useRef<HTMLDivElement>(null)
  const stepIdCounter = useRef(0)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (chatbarRef.current?.contains(e.target as Node)) return
      setDropdownOpen(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const imageToSend = pendingImage ?? attachedImage

  const clearAttachedImage = () => {
    setPendingImage(null)
    onClearAttached?.()
  }

  const setImageFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (dataUrl) setPendingImage(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) setImageFromFile(file)
        return
      }
    }
  }

  const modelConfig = MODELS.find(m => m.id === model)
  const apiKeyForModel = (() => {
    if (!modelConfig) return ''
    if (modelConfig.provider === 'google') {
      return storedApiKeys.google?.trim() || geminiApiKeyEnv?.trim() || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || ''
    }
    if (modelConfig.provider === 'openai') return storedApiKeys.openai?.trim() || ''
    if (modelConfig.provider === 'anthropic') return storedApiKeys.anthropic?.trim() || ''
    return ''
  })()
  const hasApiKey = Boolean(apiKeyForModel)

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveSteps.length, streamingText])

  // Update elapsed time
  useEffect(() => {
    if (!runStartTime) {
      setElapsedTime(0)
      return
    }
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - runStartTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [runStartTime])

  // When number of chat tabs changes, auto-scroll to rightmost
  useEffect(() => {
    if (!chatTabs || !chatTabs.length) return
  }, [chatTabs?.length])

  // Auto-scroll chat tabs to the right when tabs or active chat changes
  useEffect(() => {
    const el = tabsScrollRef.current
    if (!el) return
    const scrollToRight = () => {
      el.scrollLeft = el.scrollWidth - el.clientWidth
    }
    scrollToRight()
    requestAnimationFrame(scrollToRight)
  }, [chatTabs?.length, activeChatId])

  /** Generate unique step ID */
  const genStepId = useCallback(() => {
    stepIdCounter.current += 1
    return `step-${Date.now()}-${stepIdCounter.current}`
  }, [])

  /** Toggle step expansion */
  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  /** Add a new live step, collapsing previous one */
  const addLiveStep = useCallback((step: AgentStep) => {
    setLiveSteps(prev => [...prev, step])
    // Collapse previous live step
    if (currentLiveStepId) {
      setExpandedSteps(prev => {
        const next = new Set(prev)
        next.delete(currentLiveStepId)
        return next
      })
    }
    // Expand new step
    setExpandedSteps(prev => new Set(prev).add(step.id))
    setCurrentLiveStepId(step.id)
  }, [currentLiveStepId])

  const send = async () => {
    const text = input.trim()
    if (!text && !imageToSend) return
    setInput('')
    const displayText = text || '（附圖）'
    const imageForMessage = imageToSend && imageToSend.length <= MAX_IMAGE_DATAURL_LENGTH ? imageToSend : undefined
    setMessages(prev => [...prev, { role: 'user', text: displayText, imageDataUrl: imageForMessage }])
    chatLogToTerminal('user', { text: displayText })
    clearAttachedImage()
    setLoading(true)
    setError(null)
    setLiveSteps([])
    setExpandedSteps(new Set())
    setCurrentLiveStepId(null)
    const imageToSendThisTurn = imageToSend
    
    try {
      if (!hasApiKey) {
        const providerName = modelConfig?.provider === 'openai' ? 'OpenAI' : modelConfig?.provider === 'anthropic' ? 'Anthropic' : 'Google'
        setMessages(prev => [...prev, { role: 'agent', text: `請先設定 ${providerName} API Key（點擊頂部 🔑 按鈕）。` }])
        setLoading(false)
        return
      }
      const apiId = modelConfig?.apiId ?? 'gemini-2.0-flash'
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        text: m.text,
      }))
      
      if (mode === 'agent') {
        if (modelConfig?.provider !== 'google') {
          setMessages(prev => [...prev, { role: 'agent', text: 'Agent 模式（工具）暫時只支援 Google Gemini。請切換到 Ask 模式，或揀選 Gemini 模型。' }])
          setLoading(false)
          return
        }
        const startTime = Date.now()
        setRunStartTime(startTime)
        setStreamingText(null)
        
        const renderErrorsForAgent: RenderError[] | undefined =
          pendingRenderErrors && pendingRenderErrors.length > 0
            ? pendingRenderErrors.map(e => ({
                type: e.type,
                noteId: e.noteId,
                sectionId: e.sectionId,
                content: e.content,
                errorMessage: e.errorMessage,
              }))
            : undefined
            
        const result = await runAgentChatWithTools({
          apiKey: apiKeyForModel,
          modelApiId: apiId,
          messages: history,
          userMessage: text || '請睇呢張圖並回覆。',
          agentContext: { ...agentContext, imageUrl: imageToSendThisTurn ?? undefined },
          onToolAction,
          onLog: (line) => {
            const stepId = genStepId()
            const step = parseLogToStep(line, stepId)
            addLiveStep(step)
          },
          onStreamingText: (streamText, isThinking) => {
            setStreamingText({ text: streamText, isThinking })
          },
          attachedImage: imageToSendThisTurn ?? undefined,
          renderErrors: renderErrorsForAgent,
        })
        
        if (renderErrorsForAgent && onClearRenderErrors) {
          onClearRenderErrors()
        }
        
        const thinkingDuration = Math.floor((Date.now() - startTime) / 1000)
        
        // Convert liveSteps to stored format
        const finalSteps: AgentStep[] = [...liveSteps]
        
        setRunStartTime(null)
        setLiveSteps([])
        setStreamingText(null)
        setCurrentLiveStepId(null)
        
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
            thinkingDuration,
            steps: finalSteps,
          },
        }])
      } else {
        let reply: string
        if (modelConfig?.provider === 'openai') {
          reply = await callOpenAIAsk(apiKeyForModel, apiId, history, text || '請睇呢張圖。', imageToSendThisTurn)
        } else if (modelConfig?.provider === 'anthropic') {
          reply = await callAnthropicAsk(apiKeyForModel, apiId, history, text || '請睇呢張圖。', imageToSendThisTurn)
        } else {
          reply = await callGeminiAsk(apiKeyForModel, apiId, history, text || '請睇呢張圖。', imageToSendThisTurn)
        }
        chatLogToTerminal('agent', { text: reply })
        setMessages(prev => [...prev, { role: 'agent', text: reply }])
      }
    } catch (e) {
      setRunStartTime(null)
      setLiveSteps([])
      setStreamingText(null)
      setCurrentLiveStepId(null)
      const errMsg = e instanceof Error ? e.message : String(e)
      const isFetchFailed = /failed to fetch|network|networkerror/i.test(errMsg)
      const hint = isFetchFailed
        ? '\n\n可能原因：網絡唔通、API key 無設好、或者被防火牆/擴展擋咗。請用頂部 🔑 按鈕設定 API Key，或檢查 .env 嘅 VITE_GEMINI_API_KEY。'
        : ''
      setError(errMsg)
      setMessages(prev => [...prev, { role: 'agent', text: `出錯：${errMsg}${hint}` }])
    } finally {
      setLoading(false)
    }
  }

  /** Format duration */
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  /** Get step icon and color class */
  const getStepStyle = (type: AgentStepType, success?: boolean) => {
    switch (type) {
      case 'thinking':
        return { icon: '💭', className: 'ide-step--thinking' }
      case 'tool_call':
        return { icon: '→', className: 'ide-step--tool-call' }
      case 'tool_result':
        return { icon: '←', className: success ? 'ide-step--success' : 'ide-step--error' }
      case 'layer':
        return { icon: '◆', className: 'ide-step--layer' }
      case 'skill':
        return { icon: '◈', className: 'ide-step--skill' }
      case 'model':
        return { icon: '⚡', className: 'ide-step--model' }
      case 'message':
        return { icon: '💬', className: 'ide-step--message' }
      case 'error':
        return { icon: '⚠', className: 'ide-step--error' }
      default:
        return { icon: '•', className: 'ide-step--log' }
    }
  }

  /** Render a single step (ALL steps are collapsible) */
  const renderStep = (step: AgentStep, isLive: boolean = false) => {
    const isExpanded = expandedSteps.has(step.id) || isLive
    const { icon, className } = getStepStyle(step.type, step.success)
    
    // All steps with content > 50 chars can be collapsed
    const hasContent = step.content && step.content.length > 0
    const isCollapsible = hasContent && step.content.length > 50
    
    // Generate preview text (first line or first 80 chars)
    const firstLine = step.content.split('\n')[0]
    const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine
    
    // Type label
    const getTypeLabel = () => {
      switch (step.type) {
        case 'thinking': return '💭 Thinking'
        case 'tool_call': return step.toolName ? `→ ${step.toolName}` : '→ Tool'
        case 'tool_result': return step.success ? `← Result ✓` : `← Result ✗`
        case 'layer': return `◆ ${step.content}`
        case 'skill': return `◈ ${step.content}`
        case 'model': return `⚡ ${step.content}`
        default: return step.type
      }
    }
    
    // For layer/skill/model - just show inline, no expand
    if (step.type === 'layer' || step.type === 'skill' || step.type === 'model') {
      return (
        <div key={step.id} className={`ide-step ${className}`}>
          <div className="ide-step-inline">{getTypeLabel()}</div>
        </div>
      )
    }
    
    return (
      <div key={step.id} className={`ide-step ${className} ${isLive ? 'ide-step--live' : ''} ${isExpanded ? 'ide-step--expanded' : 'ide-step--collapsed'}`}>
        <button
          type="button"
          className="ide-step-header"
          onClick={() => toggleStep(step.id)}
        >
          {/* Chevron - always show for collapsible content */}
          {isCollapsible && (
            <span className={`ide-step-chevron ${isExpanded ? '' : 'ide-step-chevron--collapsed'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          )}
          
          {/* Type label */}
          <span className="ide-step-type">{getTypeLabel()}</span>
          
          {/* Preview when collapsed */}
          {!isExpanded && isCollapsible && step.type !== 'thinking' && (
            <span className="ide-step-preview">{preview}</span>
          )}
        </button>
        
        {/* Content - show when expanded OR when short */}
        {(isExpanded || !isCollapsible) && hasContent && (
          <div className="ide-step-content">
            {step.content}
          </div>
        )}
      </div>
    )
  }

  /** Render steps from a stored message */
  const renderStoredSteps = (run: AgentRunInfo, messageIdx: number) => {
    // Prefer parsed steps if available, otherwise parse from logs
    const steps = run.steps ?? run.logs.map((log, i) => parseLogToStep(log, `msg-${messageIdx}-step-${i}`))
    
    if (steps.length === 0 && (!run.toolCalls || run.toolCalls.length === 0)) {
      return null
    }
    
    // If we have toolCalls but no steps, render toolCalls directly
    if (steps.length === 0 && run.toolCalls && run.toolCalls.length > 0) {
      return (
        <div className="ide-steps-container">
          {run.toolCalls.map((tc, idx) => {
            const stepId = `msg-${messageIdx}-tc-${idx}`
            const isExpanded = expandedSteps.has(stepId)
            const isCollapsible = tc.result.length > 80
            const preview = tc.result.split('\n')[0].slice(0, 60)
            return (
              <div key={stepId} className={`ide-step ide-step--tool-call ${tc.success ? 'ide-step--success' : 'ide-step--error'} ${isExpanded ? 'ide-step--expanded' : 'ide-step--collapsed'}`}>
                <button
                  type="button"
                  className="ide-step-header"
                  onClick={() => toggleStep(stepId)}
                >
                  {/* Chevron */}
                  <span className={`ide-step-chevron ${isExpanded ? '' : 'ide-step-chevron--collapsed'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                  
                  {/* Tool name and status */}
                  <span className="ide-step-type">→ {tc.name}</span>
                  <span className={`ide-step-status ${tc.success ? 'ide-step-status--ok' : 'ide-step-status--error'}`}>
                    {tc.success ? '✓' : '✗'}
                  </span>
                  
                  {/* Preview when collapsed */}
                  {!isExpanded && isCollapsible && (
                    <span className="ide-step-preview">{preview}…</span>
                  )}
                </button>
                
                {/* Content */}
                {(isExpanded || !isCollapsible) && (
                  <div className="ide-step-content">
                    {Object.keys(tc.args).length > 0 && (
                      <div className="ide-step-args">
                        {Object.entries(tc.args).map(([k, v]) => (
                          <span key={k} className="ide-step-arg">
                            <span className="ide-step-arg-key">{k}:</span> {typeof v === 'string' ? (v.length > 100 ? v.slice(0, 100) + '…' : v) : JSON.stringify(v).slice(0, 100)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="ide-step-result">{tc.result}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    
    return (
      <div className="ide-steps-container">
        {steps.map(step => renderStep(step, false))}
      </div>
    )
  }

  return (
    <div className="ide-chat">
      {chatTabs && chatTabs.length > 0 && (
        <div className="ide-chat-tabs">
          <div ref={tabsScrollRef} className="ide-chat-tabs-scroll">
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
            {msg.role === 'user' && msg.imageDataUrl && (
              <div className="ide-chat-msg-image-wrap">
                <img src={msg.imageDataUrl} alt="Attached" className="ide-chat-msg-image" />
              </div>
            )}
            
            {/* Agent steps (linear display) */}
            {msg.role === 'agent' && msg.agentRun && renderStoredSteps(msg.agentRun, i)}
            
            {/* Final message text */}
            <div className="ide-chat-msg-text">{msg.text}</div>
          </div>
        ))}
        
        {/* Live agent run - steps displayed inline */}
        {loading && mode === 'agent' && (
          <div className="ide-chat-msg agent ide-chat-msg--live">
            {/* Live header showing elapsed time */}
            <div className="ide-live-header">
              <span className="ide-live-dot" />
              <span>Agent running… {formatDuration(elapsedTime)}</span>
            </div>
            
            {/* Live steps */}
            <div className="ide-steps-container">
              {liveSteps.map(step => renderStep(step, step.id === currentLiveStepId))}
            </div>
            
            {/* Streaming text (current thinking or reply) */}
            {streamingText && (
              <div className={`ide-streaming ${streamingText.isThinking ? 'ide-streaming--thinking' : ''}`}>
                {streamingText.isThinking && (
                  <span className="ide-streaming-label">
                    Thought for {formatDuration(elapsedTime)}
                  </span>
                )}
                <div className="ide-streaming-text">
                  {streamingText.text}
                  <span className="ide-streaming-cursor">▊</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {loading && mode !== 'agent' && (
          <div className="ide-chat-msg agent">
            <div className="ide-chat-loading">思考中…</div>
          </div>
        )}
        
        {error && <div className="ide-chat-error">{error}</div>}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="ide-chat-input-wrap">
        {imageToSend && (
          <div className="ide-chat-attached">
            <img src={imageToSend} alt="Attached" className="ide-chat-attached-img" />
            <button type="button" className="ide-chat-attached-remove" onClick={clearAttachedImage} title="移除">
              ×
            </button>
          </div>
        )}
        <textarea
          className="ide-chat-input"
          placeholder={imageToSend ? '可加文字再送俾 AI…' : (mode === 'agent' ? 'Plan, @ for context, / for commands' : '問我任何嘢…')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          onPaste={handlePaste}
          disabled={loading}
        />
        <div className="ide-chatbar" ref={chatbarRef}>
          <div className="ide-chatbar-dropdown">
            <button
              type="button"
              className={`ide-chatbar-pill ide-chatbar-mode ${mode === 'agent' ? 'ide-chatbar-pill--active' : ''}`}
              onClick={() => setDropdownOpen(d => (d === 'mode' ? null : 'mode'))}
              title="模式"
            >
              {mode === 'agent' ? '∞ Agent' : 'Ask'}
              <span className="ide-chatbar-chevron">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {dropdownOpen === 'mode' && (
              <ul className="ide-chatbar-dropdown-list ide-chatbar-dropdown-list--up" role="listbox">
                {(['ask', 'agent'] as const).map((m) => (
                  <li key={m} role="option">
                    <button
                      type="button"
                      className={`ide-chatbar-dropdown-option ${mode === m ? 'ide-chatbar-dropdown-option--selected' : ''}`}
                      onClick={() => { setMode(m); setDropdownOpen(null) }}
                    >
                      <span className="ide-chatbar-dropdown-icon">
                        {m === 'agent' ? '∞' : '💬'}
                      </span>
                      <span className="ide-chatbar-dropdown-label">{m === 'agent' ? 'Agent' : 'Ask'}</span>
                      {mode === m && <span className="ide-chatbar-dropdown-check">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ide-chatbar-dropdown">
            <button
              type="button"
              className="ide-chatbar-select ide-chatbar-model"
              onClick={() => setDropdownOpen(d => (d === 'model' ? null : 'model'))}
              title="AI 模型"
            >
              {MODELS.find(m => m.id === model)?.label ?? model}
              <span className="ide-chatbar-chevron">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {dropdownOpen === 'model' && (
              <div className="ide-chatbar-dropdown-list ide-chatbar-dropdown-list--up ide-chatbar-dropdown-list--models" role="listbox">
                {(['google', 'openai', 'anthropic'] as const).map((provider) => (
                  <div key={provider} className="ide-chatbar-dropdown-provider-group">
                    <div className="ide-chatbar-dropdown-group">{provider === 'google' ? 'Google' : provider === 'openai' ? 'OpenAI' : 'Anthropic'}</div>
                    {MODELS.filter(m => m.provider === provider).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        className={`ide-chatbar-dropdown-option ${model === m.id ? 'ide-chatbar-dropdown-option--selected' : ''}`}
                        onClick={() => { setModel(m.id); setDropdownOpen(null) }}
                      >
                        <span className="ide-chatbar-dropdown-label">{m.label}</span>
                        {model === m.id && <span className="ide-chatbar-dropdown-check">✓</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="ide-chatbar-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setImageFromFile(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="ide-chatbar-btn ide-chatbar-btn--upload"
            onClick={() => fileInputRef.current?.click()}
            title="上傳圖片"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button
            type="button"
            className="ide-chatbar-send"
            onClick={send}
            disabled={loading}
            title="發送"
          >
            {loading ? (
              <span className="ide-chatbar-send-spinner" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5m0 0l-5 5m5-5l5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
