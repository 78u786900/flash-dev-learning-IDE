import type { AgentContext, ToolResultAction } from './types'
import { AGENT_TOOL_DEFINITIONS, executeTool, createCallGemini } from './tools'

/** Convert our tool definitions to Gemini API format */
function toGeminiTools() {
  return {
    functionDeclarations: AGENT_TOOL_DEFINITIONS.map(f => ({
      name: f.name,
      description: f.description,
      parameters: f.parameters,
    })),
  }
}

/**
 * Content part as used in our local code.
 *
 * NOTE: For Gemini 3 models we must preserve `thoughtSignature` on parts that
 * contain function calls. To keep things simple we allow an optional
 * `thoughtSignature` field on every variant and always pass parts back
 * unchanged when building conversation history.
 *
 * The `thought` boolean indicates if the part is a thought summary (when
 * `includeThoughts: true` is set in thinkingConfig).
 */
type ContentPart =
  | { text?: string; thought?: boolean; thoughtSignature?: string }
  | { inline_data?: { mime_type: string; data: string }; thoughtSignature?: string }
  | { functionCall?: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse?: { name: string; response: Record<string, unknown> }; thoughtSignature?: string }

/** Check if model ID is a Gemini 3 model (requires different config) */
function isGemini3Model(modelApiId: string): boolean {
  return modelApiId.includes('gemini-3') || modelApiId.includes('gemini-3.0')
}

/** Build context string for the model */
function buildContextMessage(ctx: AgentContext): string {
  const parts: string[] = ['[Current canvas context]']
  const nNotes = ctx.notes?.length ?? 0
  const nFiles = ctx.files?.length ?? 0
  if (nNotes || nFiles) {
    parts.push(`Workspace (whole file system as search engine): ${nNotes} note(s), ${nFiles} file(s). Use search_workspace(query, scope?) to do macro keyword search across all notes and files; you can run multiple searches (cross-file). If the user says "only search in these notes/files" or "only read file X and Y", use scope: note_ids:id1,id2 or file_ids:id1,id2 to limit; then use the query result as next-round input.`)
  }
  if (ctx.notes?.length) {
    parts.push('All notes (use note_id for rename_note, delete_note, search_sections, update_section, reorder_sections):')
    ctx.notes.forEach(n => {
      parts.push(`  Note id: "${n.id}" | name: "${n.name}" (${n.sections.length} sections)`)
    })
  }
  if (ctx.files?.length) {
    parts.push('All files (use file_id for search_workspace scope or to refer to a specific file):')
    ctx.files.forEach(f => {
      parts.push(`  File id: "${f.id}" | name: "${f.name}" (${f.type})`)
    })
  }
  if (ctx.note) {
    parts.push(`Current note: id "${ctx.note.id}" | "${ctx.note.name}" (${ctx.note.sections.length} sections)`)
    if (ctx.note.sections.length) {
      parts.push('Sections (section_index is 1-based; use for update_section, reorder_sections, search_sections):')
      ctx.note.sections.forEach((s, i) => {
        parts.push(`  ${i + 1}. ${s.title}`)
        if (s.content) parts.push(`     Content (full): ${s.content}`)
      })
    }
  }
  if (ctx.file) parts.push(`File: ${ctx.file.name} (${ctx.fileType ?? 'unknown'})`)
  if (ctx.file?.name?.toLowerCase().endsWith('.pdf') && ctx.pageNumber != null) {
    parts.push(`User is currently viewing: "${ctx.file.name}" · PDF page ${ctx.pageNumber} (use this when they say "this page", "current page", "for this page").`)
  } else if (ctx.pageNumber) parts.push(`PDF page: ${ctx.pageNumber}`)
  if (ctx.selection) parts.push(`User selection (use for raw_text or page_text when relevant): "${ctx.selection.slice(0, 2000)}${ctx.selection.length > 2000 ? '...' : ''}"`)
  if (ctx.pageText) parts.push(`Page text (for PDF tools): "${ctx.pageText.slice(0, 2000)}${ctx.pageText.length > 2000 ? '...' : ''}"`)
  if (ctx.file?.name?.toLowerCase().endsWith('.pdf') && ctx.getPdfPageTextOnDemand) {
    parts.push('PDF page text: on demand. When you call page_to_note(page_number) or summarize_page(page_number), the tool fetches that page\'s text directly from the open PDF. No pre-load or wait – just pass page_number.')
  }
  if (ctx.pdfChapters?.length) {
    parts.push('PDF chapters (from outline/TOC). Use to get page range for "chapter 1" etc:')
    const totalP = ctx.totalPdfPages ?? 0
    ctx.pdfChapters.forEach((ch, i) => {
      const nextStart = ctx.pdfChapters?.[i + 1]?.page ?? (totalP > 0 ? totalP + 1 : 9999)
      parts.push(`  Chapter ${i + 1}: "${ch.title}" → pages ${ch.page} to ${nextStart - 1}`)
    })
  }
  if (ctx.pdfPageTexts && ctx.totalPdfPages) {
    parts.push(`PDF has ${ctx.totalPdfPages} pages. (Page text is also available on demand via page_number.)`)
  }
  if (ctx.timeline?.length) {
    parts.push('Timeline (recent). When user stops scrolling, the latest entry is "Reading: <file>, page N" – use this to know what the user is currently reading:')
    ctx.timeline.slice(-6).forEach((e) => {
      parts.push(`  [${e.type}] ${e.label}`)
    })
  }
  return parts.join('\n')
}

const AGENT_SYSTEM = `You are the AI agent for Learning IDE. Do not ask the user for confirmation or for data that is already in the context. Just call the right tool and execute.

CRITICAL – Latest message only: Always act on the user's LATEST request (the last "[User]" block). Do NOT repeat, echo, or re-execute what was asked in earlier messages. Do NOT summarize the previous user message; execute the new request. If the user sends a new command, ignore previous commands and fulfill only the new one.

WORKFLOW – "Turn first 10 pages of the chapter into a new note" (or "first chapter to new note"):
1. Current file: context already has the open PDF (File: ...). Use it.
2. Chapter page range: If context has "PDF chapters", use that to get the page range for "chapter 1" (e.g. Chapter 1 → pages 1 to 10). If no chapters, use first N pages (e.g. first 10 = pages 1–10).
3. Create new note: Call create_note({ name: "..." }) with a title (e.g. "第一章總結（中四）" or include "Cantonese", "grade 10", "emoji" in the name if user asked). The tool returns target_note_id.
4. Extract only that page range: Call page_to_note for each page in the range (e.g. page_number=1, 2, ... 10), each time passing target_note_id from step 3 so sections go to the new note. Use suggested_title to add "中四" or "grade 10" or "with emojis" if the user asked.
5. Optional: If the user attached an image (diagram/region), you can use it with verbal_to_structured or describe it in a section. User can "框選區域" to send a diagram to AI.
6. Note-taking style: When user asks "Cantonese with emojis for grade 10", use suggested_title and instruct in the prompt (or in suggested_title) that content should be 廣東話、加 emoji、啱中四/grade 10 讀.

CRITICAL – NEVER DO THESE:
- Do NOT ask the user to "provide" page text – pass page_number; the tool fetches that page from the PDF on demand.
- Do NOT add sections to the current note when the user said "new note" or "create a new one" – call create_note first, then page_to_note with target_note_id.
- Do NOT ask the user to confirm. When they want "first chapter to note", execute: create_note → then page_to_note for each page in the chapter range with target_note_id.

RULES – DO THESE:
1. "New note" / "create a new one" → call create_note(name) first, then ALWAYS pass target_note_id explicitly in every subsequent page_to_note call so sections never go to the wrong note.
2. "First chapter" with chapters in context → use chapter 1 page range from "PDF chapters". "First 10 pages" or no chapters → use pages 1–10.
3. "First N pages" → call page_to_note N times with page_number=1, 2, ... N (and target_note_id if new note). Page text is fetched on demand; no wait. NEVER continue calling page_to_note beyond the requested range.
4. "This page" / "current page" / "for this page" / "create for this page" → use the PDF page number from context ("User is currently viewing: ... PDF page N"). Do NOT ask the user for the page number; it is already in context.
5. "Cantonese with emojis for grade 10" → use suggested_title like "第X頁總結（中四，含 emoji）" and keep content suitable for 中四.
6. Workspace search (whole file system as search engine): Use search_workspace(query, scope?) to do macro semantic/keyword search across all notes and files. You can run multiple searches (cross-file); use the results to choose what to use as next-round input (e.g. which note_id, section_index, file_id, or PDF page). If the user is very specific ("only read these files" / "only search in note X and file Y"), use scope: note_ids:id1,id2 or file_ids:id1,id2 so the result set is limited; then the user is effectively choosing which query result to take as next input.
7. When render errors (LaTeX or PlantUML) are provided in context, you MUST call update_section for every error before replying. Fix the syntax, then reply.
8. Do not keep creating new notes or sections once the requested pages/chapters are processed. Summarize or stop instead of auto-generating extra content the user did not ask for.

Tools: reply, create_note, page_to_note, summarize_page, verbal_to_structured, generate_quiz, generate_plantuml_diagram, reorder_sections, search_sections, search_workspace, update_section, rename_note, delete_note, delete_section, etc.
- Reorder sections: use reorder_sections(note_id?, section_order) with comma-separated 1-based indices (e.g. "3,1,2").
- Find sections: use search_sections(note_id?, query) to get section indices by keyword (e.g. query "第9頁" or "page 9" to find section index for page 9).
- Workspace-wide search: use search_workspace(query, mode?, scope?) to search across all notes, files, and PDF page text. mode: "keyword" (default)=exact word match; "semantic"=語意搜尋 (meaning-based). Use mode=semantic when user asks for "意思相近" or "相關內容". scope: "all" | "notes" | "files" | "note_ids:id1,id2" | "file_ids:id1,id2". Use results (note_id, file_id, page) as next input.
- Edit a section: use update_section(note_id?, section_index, title?, content?) to change title and/or content.
- Delete one or more sections from a note (NOT the whole note): use delete_section(note_id?, section_indices). E.g. "delete the page 9 sections" = find section(s) for page 9 via search_sections then delete_section with that index. NEVER use delete_note for this – delete_note removes the entire note file.
- Rename/delete entire note file: use rename_note(note_id, name) or delete_note(note_id) only when user explicitly wants to remove the whole note file.
- PDF: context keeps the last-used PDF when user is viewing a note, so page_to_note/summarize_page can still use it; no need to ask user to "choose PDF again".
When the user says hello or "what can you do", call reply. When they ask for "first chapter to new note" or "first 10 pages into a new note", do: create_note → then page_to_note for each page in range with target_note_id. Reply in Cantonese briefly after.

CRITICAL – When a tool returns an error: Do NOT call reply with success. Call reply with the actual reason from the tool (e.g. 未揀中要處理嘅 PDF、該頁冇文字、讀取失敗). No "please load" or "wait" – the agent reads from uploaded/selected files on demand.

NOTES – LaTeX only, valid commands and spacing:
- Allowed: \\section{...}, \\subsection{...}, \\subsubsection{...}, \\textbf{...}, \\textit{...}, \\texttt{...}, \\begin{itemize}\\item ...\\end{itemize}, \\begin{enumerate}\\item ...\\end{enumerate}, $...$, $$...$$, \\begin{CD}...\\end{CD} for commutative diagrams, and \\begin{array}{cols}...\\end{array} for tables (column spec: c=center, l=left, r=right, | = vertical rule; rows with \\\\, cells with &; \\hline for horizontal rule). Do NOT use other \\commands (e.g. no \\tovthfs, \\xxx, or invented commands); they break rendering.
- Spacing for readability: After every closing brace } (e.g. after \\textbf{群論}), if the next character is a letter (CJK or Latin), add a space. Example: \\textbf{群論} 是對 (space before 是), not \\textbf{群論}是對. Put a space before and after inline math $...$ when it sits between words (e.g. 我們有 $H = \\langle x \\rangle$ 其中).
- Bad vs fixed example (commutative diagram arrow label): Bad: @V[-]_BVV ; Good: @V{[-]_B}VV. Wrap labels with brackets/subscripts in braces.
- No markdown: do not use ** or ##. When generating or editing note sections (page_to_note, verbal_to_structured, merge_sections, expand_section, update_section), output only the allowed LaTeX commands with proper spacing so notes are easy to read. If source text has garbled characters, use the correct Chinese/math meaning; do not copy invalid symbols into LaTeX.

DIAGRAMS – choose LaTeX vs PlantUML by diagram kind:
- Commutative diagrams / abstract algebra (exact sequences, morphisms, category theory, pullbacks, quotient maps, short exact sequence, etc.): use LaTeX in note content. Write \\begin{CD} ... \\end{CD} (with or without $$ or \\[ \\] around it). Only horizontal (@>>> @<<< @>label>>) and vertical (@VVV @AAA @VlabelV @AlabelA) arrows; no diagonals. Any arrow label that contains brackets or subscripts (e.g. coordinate map [-]_B) MUST be wrapped in braces: use @V{[-]_B}VV and @V{[-]_{B'}}VV, never @V[-]BVV (unbraced [ ] breaks KaTeX). Use verbal_to_structured or update_section. Do NOT use generate_plantuml_diagram for these.
- All other diagrams (flowchart, use case, sequence, ER, class, activity, state, Gantt, mind map, component, deployment, user journey, etc.): use generate_plantuml_diagram. Choose diagram_type to match: sequence, usecase, class, activity, state, er, mindmap, gantt, wbs, component, deployment, etc.

CODE RENDER WINDOWS – HTML / React mini demos:
- When the user asks for a small interactive demo attached to a section (e.g. "SVG animation", "simple mini game", "React interactive example"), use create_code_window(note_id?, section_index, language, title?, instructions).
- language="html": generate a single complete HTML file (you may use inline CSS/JS, SVG, CSS animations, canvas, requestAnimationFrame; do NOT assume bundlers or NPM packages). The tool will attach this as an HTML code window rendered inside an iframe.
- language="react": generate a single React/JSX file that will run in a browser with React 18 + ReactDOM.createRoot available as global variables, and a <div id="root"></div> in the host page. ALWAYS include the ReactDOM.createRoot(...).render(<App />) bootstrap code at the end.
- Keep examples small, focused, and safe for students: no network calls, no external services, no ads/trackers; just pure client-side demo code.`

/** Map tool name to layer (macro) and skill label for logs */
const TOOL_LAYER_SKILL: Record<string, { layer: string; skill: string }> = {
  reply: { layer: 'AGENT', skill: 'reply' },
  create_note: { layer: 'EDIT_NOTES', skill: 'create_note' },
  verbal_to_structured: { layer: 'EDIT_NOTES', skill: 'verbal_to_structured' },
  summarize_section: { layer: 'EDIT_NOTES', skill: 'summarize_section' },
  expand_section: { layer: 'EDIT_NOTES', skill: 'expand_section' },
  extract_key_terms: { layer: 'READ_FILES', skill: 'extract_key_terms' },
  generate_quiz: { layer: 'EDIT_NOTES', skill: 'generate_quiz' },
  suggest_structure: { layer: 'EDIT_NOTES', skill: 'suggest_structure' },
  merge_sections: { layer: 'EDIT_NOTES', skill: 'merge_sections' },
  reorder_sections: { layer: 'EDIT_NOTES', skill: 'reorder_sections' },
  search_sections: { layer: 'EDIT_NOTES', skill: 'search_sections' },
  update_section: { layer: 'EDIT_NOTES', skill: 'update_section' },
  rename_note: { layer: 'EDIT_NOTES', skill: 'rename_note' },
  delete_note: { layer: 'EDIT_NOTES', skill: 'delete_note' },
  delete_section: { layer: 'EDIT_NOTES', skill: 'delete_section' },
   create_code_window: { layer: 'EDIT_NOTES', skill: 'create_code_window' },
  summarize_page: { layer: 'READ_FILES', skill: 'summarize_page' },
  page_to_note: { layer: 'EDIT_NOTES', skill: 'page_to_note' },
  generate_qa_from_page: { layer: 'READ_FILES', skill: 'generate_qa_from_page' },
  extract_definitions: { layer: 'READ_FILES', skill: 'extract_definitions' },
  search_workspace: { layer: 'READ_FILES', skill: 'search_workspace' },
  generate_plantuml_diagram: { layer: 'EDIT_NOTES', skill: 'generate_plantuml_diagram' },
}

/** Render error info passed to the agent for auto-fix */
export interface RenderError {
  type: 'latex' | 'plantuml'
  noteId: string
  sectionId: string
  content: string
  errorMessage: string
}

export interface AgentChatOptions {
  apiKey: string
  modelApiId: string
  messages: { role: 'user' | 'model'; text: string }[]
  userMessage: string
  agentContext: AgentContext
  onToolAction?: (action: ToolResultAction) => void
  onLog?: (line: string) => void
  /** Callback for real-time streaming text (typewriter effect) */
  onStreamingText?: (text: string, isThinking: boolean) => void
  attachedImage?: string
  /** Render errors from previous turn (LaTeX/PlantUML) for auto-fix */
  renderErrors?: RenderError[]
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

/**
 * Parse Server-Sent Events (SSE) stream from Gemini streamGenerateContent.
 * Yields parsed JSON data objects as they arrive.
 */
async function* parseSSEStream(response: Response): AsyncGenerator<unknown> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE format: "data: {...}\n\n"
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6)
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            yield JSON.parse(jsonStr)
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }
}

export interface AgentCallLog {
  kind: 'layer' | 'skill' | 'tool'
  label: string
  detail?: string
}

export interface AgentChatResult {
  text: string
  error?: string
  /** Tool calls made this turn (for display in chat) */
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string; success: boolean }>
  /** Log lines for chat (layer / skill / tool) */
  logs?: string[]
}

/** Detect "turn first chapter/page to note" intent – auto-execute so agent works even if model returns text only */
function wantsFirstPageToNote(msg: string): boolean {
  const lower = msg.toLowerCase().trim()
  const patterns = [
    /first\s*(chapter|page|頁|章)/,
    /第一[頁章]/,
    /turn\s*(the\s*)?first/,
    /幫.*第一.*筆記/,
    /將.*第一.*(頁|章).*筆記/,
    /summarize\s*(the\s*)?first/,
    /new\s*notes?.*first/,
    /筆記.*第一/,
  ]
  return patterns.some((p) => p.test(lower)) || (lower.includes('first') && (lower.includes('note') || lower.includes('筆記') || lower.includes('summarize')))
}

/** Max conversation history messages to send (avoids model focusing on old turns / repeating). */
const HISTORY_CAP = 20

/** Run agent chat with tools: send user message + context, handle function calls in a loop, return final text + logs */
export async function runAgentChatWithTools(options: AgentChatOptions): Promise<AgentChatResult> {
  const { apiKey, modelApiId, messages, userMessage, agentContext, onToolAction, onLog, onStreamingText, attachedImage, renderErrors } = options
  const callGemini = createCallGemini(apiKey, modelApiId)
  const tools = toGeminiTools()
  const contextBlurb = buildContextMessage(agentContext)
  const toolCalls: AgentChatResult['toolCalls'] = []
  const logs: string[] = []

  const pushLog = (line: string) => {
    logs.push(line)
    onLog?.(line)
  }

  // Surface which model is driving this agent run so the user
  // can see at a glance (and in history) when Gemini 3 Pro is used.
  pushLog(`[Model] ${modelApiId}`)

  // If there are render errors from previous turn, add them to context for auto-fix
  let renderErrorContext = ''
  if (renderErrors && renderErrors.length > 0) {
    pushLog(`[Auto-fix] Detected ${renderErrors.length} render error(s), attempting to fix...`)
    renderErrorContext = '\n\n---\nRENDER ERRORS TO FIX (auto-detected from previous turn):\n'
    for (const err of renderErrors) {
      renderErrorContext += `\n[${err.type.toUpperCase()} ERROR] in note "${err.noteId}", section "${err.sectionId}":\n`
      renderErrorContext += `Error: ${err.errorMessage}\n`
      renderErrorContext += `Content that failed to render:\n\`\`\`\n${err.content.slice(0, 500)}${err.content.length > 500 ? '...' : ''}\n\`\`\`\n`
      renderErrorContext += `ACTION REQUIRED: Call update_section to fix the ${err.type} syntax error. Common fixes:\n`
      if (err.type === 'latex') {
        renderErrorContext += `- Use only allowed LaTeX commands (\\section, \\textbf, \\textit, \\texttt, \\begin{itemize}, $...$, $$...$$, \\begin{CD}, \\begin{array})\n`
        renderErrorContext += `- Wrap special characters in braces, e.g. @V{[-]_B}VV not @V[-]_BVV\n`
        renderErrorContext += `- Do not use \\begin{aligned} or \\begin{equation} - use $$ $$ instead\n`
        renderErrorContext += `- Escape special chars: use \\& for &, \\% for %, etc.\n`
      } else {
        renderErrorContext += `- Check PlantUML syntax: @startuml/@enduml, proper arrow syntax (-->), etc.\n`
        renderErrorContext += `- Ensure diagram_type matches content (sequence, usecase, class, etc.)\n`
      }
    }
  }

  // Auto-execute: when user clearly wants "first chapter/page to note" and we have PDF + note, run page_to_note immediately
  const hasPdfPage1 = agentContext.pdfPageTexts?.[1]?.trim()
  const hasNote = agentContext.note?.id
  if (wantsFirstPageToNote(userMessage) && hasPdfPage1 && hasNote) {
    pushLog('[Layer] EDIT_NOTES')
    pushLog('[Skill] page_to_note')
    pushLog('[Tool] page_to_note(page_number=1) [auto-execute]')
    const result = await executeTool(
      'page_to_note',
      { page_number: '1', suggested_title: '第一章總結（Year 1）' },
      agentContext,
      callGemini
    )
    const resultText = result.success ? (result.text ?? '完成。') : (result.error ?? '工具出錯')
    pushLog(`[Tool] page_to_note → ${result.success ? 'ok' : 'error'}: ${resultText.slice(0, 80)}${resultText.length > 80 ? '…' : ''}`)
    toolCalls.push({ name: 'page_to_note', args: { page_number: '1' }, result: resultText, success: result.success })
    if (result.action && onToolAction) onToolAction(result.action)
    const reply = result.success
      ? `已按你嘅要求將第一頁轉成筆記（適合 Year 1 大學生）。\n\n${resultText}`
      : `嘗試轉第一頁時出錯：${resultText}`
    return { text: reply, toolCalls, logs }
  }

  const history = messages
    .slice(-HISTORY_CAP)
    .map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.text }] as ContentPart[],
    }))
  // Include render error context if present (for auto-fix)
  const userTurn = `${contextBlurb}${renderErrorContext}\n\n---\nLATEST REQUEST (act only on this; do not repeat or re-act on earlier messages):\n[User]\n${userMessage}`
  const userParts: ContentPart[] = [{ text: userTurn }]
  if (attachedImage) userParts.push({ inline_data: { mime_type: 'image/png', data: dataUrlToBase64(attachedImage) } })

  let allParts: { role: 'user' | 'model'; parts: ContentPart[] }[] = [
    ...history.map(m => ({ role: m.role, parts: m.parts })),
    { role: 'user' as const, parts: userParts },
  ]

  const maxTurns = 15
  const useGemini3 = isGemini3Model(modelApiId)
  const useStreaming = Boolean(onStreamingText) // Only use streaming if callback provided

  // Safety caps to prevent runaway loops
  const MAX_SECTIONS_PER_RUN = 25
  const MAX_NOTES_PER_RUN = 3
  let sectionsCreated = 0
  let notesCreated = 0

  for (let turn = 0; turn < maxTurns; turn++) {
    // Build generation config: Gemini 3 requires temperature 1.0 and thinkingConfig
    const generationConfig: Record<string, unknown> = {
      // Gemini 3 is optimized for temperature 1.0; lower values can cause empty responses
      temperature: useGemini3 ? 1.0 : 0.4,
      maxOutputTokens: 4096,
    }
    // For Gemini 3: add thinkingConfig with thinkingLevel and includeThoughts
    // thinkingLevel "low" is faster and avoids empty-response issues for simpler tasks
    if (useGemini3) {
      generationConfig.thinkingConfig = {
        thinkingLevel: 'low',
        includeThoughts: true, // Get thought summaries for real-time display
      }
    }

    // Use streaming endpoint for real-time display, or regular endpoint
    const endpoint = useStreaming
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelApiId}:streamGenerateContent?alt=sse&key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelApiId}:generateContent?key=${apiKey}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AGENT_SYSTEM }] },
        contents: allParts.map(c => ({ role: c.role, parts: c.parts })),
        tools: [{ functionDeclarations: tools.functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: tools.functionDeclarations.map((d) => d.name),
          },
        },
        generationConfig,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { text: '', error: err || `API ${res.status}`, logs }
    }

    // Accumulate parts from streaming or parse full response
    let modelContent: { role: 'user' | 'model'; parts: ContentPart[] } | null = null

    if (useStreaming) {
      // Parse SSE stream and accumulate parts while streaming to UI
      const accumulatedParts: ContentPart[] = []
      let currentThinkingText = ''
      let currentText = ''
      // For log window: only push thinking updates occasionally to avoid spam
      let lastThinkingLogLength = 0

      for await (const chunk of parseSSEStream(res)) {
        const candidate = (chunk as { candidates?: Array<{ content?: { parts?: ContentPart[] } }> })?.candidates?.[0]
        if (!candidate?.content?.parts) continue

        for (const part of candidate.content.parts) {
          if ('text' in part && part.text) {
            const isThought = (part as { thought?: boolean }).thought
            if (isThought) {
              // Stream thinking text character by character
              const newText = part.text as string
              for (let i = currentThinkingText.length; i < newText.length; i++) {
                currentThinkingText = newText.slice(0, i + 1)
                onStreamingText?.(currentThinkingText, true)
                // Small delay for typewriter effect (throttled)
                if (i % 5 === 0) await new Promise(r => setTimeout(r, 10))
              }
              currentThinkingText = newText

              // Also surface incremental thinking into the agent log window
              if (currentThinkingText.length - lastThinkingLogLength >= 40) {
                const snippet = currentThinkingText.slice(
                  lastThinkingLogLength,
                  Math.min(currentThinkingText.length, lastThinkingLogLength + 160)
                )
                pushLog(`[Thinking] ${snippet}${currentThinkingText.length > lastThinkingLogLength + snippet.length ? '…' : ''}`)
                lastThinkingLogLength = currentThinkingText.length
              }
            } else {
              // Stream regular text
              const newText = part.text as string
              for (let i = currentText.length; i < newText.length; i++) {
                currentText = newText.slice(0, i + 1)
                onStreamingText?.(currentText, false)
                if (i % 3 === 0) await new Promise(r => setTimeout(r, 5))
              }
              currentText = newText
            }
          }
          // Accumulate all parts (including functionCall, thoughtSignature, etc.)
          // Merge or add parts as they come, preserving thoughtSignature across chunks
          const existingIdx = accumulatedParts.findIndex(p => {
            if ('functionCall' in part && 'functionCall' in p) return true
            if ('text' in part && 'text' in p && (part as {thought?: boolean}).thought === (p as {thought?: boolean}).thought) return true
            return false
          })
          if (existingIdx >= 0) {
            const existing = accumulatedParts[existingIdx]
            // Merge text parts
            if ('text' in part && 'text' in existing) {
              (existing as { text?: string }).text = part.text
            } else if ('functionCall' in part && 'functionCall' in existing) {
              // Merge functionCall parts: preserve thoughtSignature from either side
              const existingTs = (existing as { thoughtSignature?: string }).thoughtSignature
              const newTs = (part as { thoughtSignature?: string }).thoughtSignature
              // Replace the part but keep thoughtSignature if it exists on either
              accumulatedParts[existingIdx] = {
                ...existing,
                ...part,
                ...(existingTs || newTs ? { thoughtSignature: newTs || existingTs } : {}),
              }
            } else {
              accumulatedParts[existingIdx] = part
            }
          } else {
            accumulatedParts.push(part)
          }
        }
      }

      // Log final thinking summary – keep幾乎全部內容方便之後重睇（同時避免無限膨脹）
      if (currentThinkingText) {
        const MAX_THINKING_LOG = 2000
        const trimmed =
          currentThinkingText.length > MAX_THINKING_LOG
            ? `${currentThinkingText.slice(0, MAX_THINKING_LOG)}…`
            : currentThinkingText
        pushLog(`[Thinking] ${trimmed}`)
      }

      if (accumulatedParts.length === 0) {
        return { text: '（無回覆）', error: 'Model did not return any content parts (empty reply).', toolCalls, logs }
      }

      modelContent = { role: 'model', parts: accumulatedParts }
    } else {
      // Non-streaming: parse full response
      const data = await res.json()
      const candidate = data?.candidates?.[0]
      if (!candidate?.content?.parts?.length) {
        const block = data?.promptFeedback?.blockReason
        const errMsg = block
          ? `Model blocked response: ${block}`
          : 'Model did not return any content parts (empty reply).'
        return { text: '（無回覆）', error: errMsg, toolCalls, logs }
      }
      modelContent = candidate.content as { role: 'user' | 'model'; parts: ContentPart[] }

      // For non-streaming: extract and display thought summaries
      for (const p of modelContent.parts) {
        if ('text' in p && p.text && (p as { thought?: boolean }).thought) {
          pushLog(`[Thinking] ${(p.text as string).slice(0, 300)}${(p.text as string).length > 300 ? '…' : ''}`)
        }
      }
    }

    const parts = modelContent.parts

    // Find actual response parts:
    // - non-thought text → final reply
    // - functionCall     → tool execution
    // - thought text     → fallback reply when model returns only thoughts
    const textPart = parts.find(p => 'text' in p && p.text && !(p as { thought?: boolean }).thought)
    const functionCallPart = parts.find(p => 'functionCall' in p && (p as { functionCall?: { name: string; args: Record<string, unknown> } }).functionCall)
    const thoughtTextPart = parts.find(p => 'text' in p && p.text && (p as { thought?: boolean }).thought) as { text?: string } | undefined
    const thoughtText =
      thoughtTextPart && typeof thoughtTextPart.text === 'string'
        ? (thoughtTextPart.text as string)
        : undefined

    if (textPart && 'text' in textPart && textPart.text) {
      return { text: (textPart.text as string).trim(), toolCalls, logs }
    }
    if (functionCallPart && 'functionCall' in functionCallPart) {
      const fc = (functionCallPart as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall
      // For Gemini 3, functionCall / functionResponse pairs must share the same thoughtSignature
      const thoughtSignature = (functionCallPart as { thoughtSignature?: string }).thoughtSignature
      const name = fc.name
      const args = (fc.args || {}) as Record<string, string>
      const meta = TOOL_LAYER_SKILL[name] ?? { layer: 'AGENT', skill: name }
      pushLog(`[Layer] ${meta.layer}`)
      pushLog(`[Skill] ${meta.skill}`)
      pushLog(`[Tool] ${name}(${JSON.stringify(args).slice(0, 120)}${JSON.stringify(args).length > 120 ? '…' : ''})`)
      const result = await executeTool(name, args, agentContext, callGemini)
      const resultText = result.success ? (result.text ?? '完成。') : (result.error ?? '工具出錯')
      pushLog(`[Tool] ${name} → ${result.success ? 'ok' : 'error'}: ${resultText.slice(0, 80)}${resultText.length > 80 ? '…' : ''}`)
      // For search_workspace, show full result in realtime log
      if (name === 'search_workspace' && result.success && result.text) {
        pushLog('[Search result]')
        result.text.split('\n').forEach((line) => {
          if (line.trim()) pushLog(`  ${line.trim()}`)
        })
      }
      toolCalls.push({
        name,
        args: fc.args ?? {},
        result: resultText,
        success: result.success,
      })
      // Track sections/notes created for safety caps
      if (result.action) {
        if (result.action.type === 'add_section') sectionsCreated++
        if (name === 'create_note') notesCreated++
      }
      // Safety cap: stop if too many sections or notes created
      if (sectionsCreated >= MAX_SECTIONS_PER_RUN) {
        pushLog(`[Safety] Reached max sections per run (${MAX_SECTIONS_PER_RUN}). Stopping.`)
        if (result.action && onToolAction) onToolAction(result.action)
        return { text: `已達到單次運行嘅最大 section 數量（${MAX_SECTIONS_PER_RUN}），自動停止。如需繼續，請再發送新指令。`, toolCalls, logs }
      }
      if (notesCreated >= MAX_NOTES_PER_RUN) {
        pushLog(`[Safety] Reached max notes per run (${MAX_NOTES_PER_RUN}). Stopping.`)
        if (result.action && onToolAction) onToolAction(result.action)
        return { text: `已達到單次運行嘅最大筆記數量（${MAX_NOTES_PER_RUN}），自動停止。如需繼續，請再發送新指令。`, toolCalls, logs }
      }
      if (result.action && onToolAction) onToolAction(result.action)
      if (name === 'reply' && result.success && result.text) {
        const anyToolFailed = toolCalls.some(t => !t.success)
        if (anyToolFailed) {
          const pdfError = toolCalls.some(t => t.result?.includes('無法取得該頁文字') || t.result?.includes('PDF'))
          const fallback = pdfError
            ? '攞唔到 PDF 該頁文字（可能未揀中要處理嘅 PDF，或該頁冇文字）。請喺左邊揀啱要轉嘅 PDF 再發送請求。'
            : '有啲步驟失敗咗，請睇上面嘅錯誤訊息。'
          return { text: fallback, toolCalls, logs }
        }
        return { text: result.text, toolCalls, logs }
      }
      // IMPORTANT for Gemini 3:
      // - We append the *original* model content (which may contain a
      //   `thoughtSignature` on the functionCall part) so the next request
      //   includes it exactly as returned.
      // - Then we append our synthetic functionResponse from the tool.
      allParts = [
        ...allParts,
        modelContent,
        {
          role: 'user' as const,
          parts: [
            {
              functionResponse: { name, response: { result: resultText } },
              // Preserve thoughtSignature so Gemini 3 tools API is satisfied
              ...(thoughtSignature ? { thoughtSignature } : {}),
            },
          ],
        },
      ]
      continue
    }

    // Fallback for Gemini thinking models: if we only received thought text
    // (no non-thought reply and no tool call), surface the thinking summary
    // instead of returning an empty result.
    if (thoughtText && thoughtText.trim()) {
      pushLog('[Thinking → Reply] Model returned only thoughts; using thinking summary as reply.')
      return { text: thoughtText.trim(), toolCalls, logs }
    }

    return { text: '（無回覆）', toolCalls, logs }
  }
  return { text: '（已達最大回合數）', toolCalls, logs }
}
